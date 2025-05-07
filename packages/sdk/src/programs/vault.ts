import { Program, Provider } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import {
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
  FloatLike,
  SafeAmount,
  TransactionArgs,
  WalletContext,
  AddressWithTransactionSignature,
} from "@stabbleorg/anchor-contrib";
import { Vault, VaultData, PriceFeed, WeightedPool, StablePool } from "../accounts";
import { type Vault as IDLType } from "../generated/vault";
import IDL from "../generated/idl/vault.json";

export const AMM_VAULT_PROGRAM_ID = new PublicKey(IDL.address);
export const AMM_ERRORS = new Map(IDL.errors.map((error) => [error.code, error.msg]));

export type VaultProgram = Program<IDLType>;

export type PoolKind = "stable_swap" | "weighted_swap";

export class VaultContext<T extends Provider> extends WalletContext<T> {
  readonly program: VaultProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, provider);
  }

  async loadVault(vaultAddress: PublicKey): Promise<Vault> {
    const account = await this.program.account.vault.fetch(vaultAddress);

    return new Vault(vaultAddress, account);
  }

  async loadVaults(): Promise<Vault[]> {
    const accounts = await this.program.account.vault.all();

    return accounts.map((data) => new Vault(data.publicKey, data.account));
  }

  async loadPriceFeeds(vaultAddress: PublicKey): Promise<PriceFeed[]> {
    const accounts = await this.program.account.priceFeed.all([
      {
        memcmp: {
          offset: 8,
          bytes: vaultAddress.toBase58(),
        },
      },
    ]);

    return accounts.map((data) => new PriceFeed(data.publicKey, data.account));
  }

  async initialize({
    keypair = Keypair.generate(),
    beneficiaryAddress,
    beneficiaryFee,
    kind,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    keypair?: Keypair;
    beneficiaryAddress: PublicKey;
    beneficiaryFee: FloatLike;
    kind: PoolKind;
  }>): Promise<AddressWithTransactionSignature> {
    const address = keypair.publicKey;

    let withdrawAuthorityAddress: PublicKey;
    let withdrawAuthorityBump: number;

    switch (kind) {
      case "stable_swap":
        [withdrawAuthorityAddress, withdrawAuthorityBump] = StablePool.getWithdrawAuthorityAddressAndBump(address);
        break;
      case "weighted_swap":
      default:
        [withdrawAuthorityAddress, withdrawAuthorityBump] = WeightedPool.getWithdrawAuthorityAddressAndBump(address);
        break;
    }

    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space: this.program.account.vault.size,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(this.program.account.vault.size),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(
          withdrawAuthorityAddress,
          withdrawAuthorityBump,
          beneficiaryAddress,
          SafeAmount.toGiga(beneficiaryFee),
        )
        .accountsStrict({
          admin: this.walletAddress,
          vault: address,
          vaultAuthority: Vault.getAuthorityAddress(address),
        })
        .instruction(),
    ];

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }

  async createMissingTokenAccounts({
    vault,
    mintAddresses,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    vault: Vault;
    mintAddresses: PublicKey[];
  }>): Promise<TransactionSignature | null> {
    const instructions: TransactionInstruction[] = [];
    for (const mintAddress of mintAddresses) {
      const account = await this.provider.connection.getAccountInfo(mintAddress);
      if (!account) throw Error("Invalid mint address");
      const tokenProgramId = account.owner;

      const { instruction: createVaultTokenInstruction } = await this.getOrCreateAssociatedTokenAddressInstruction(
        mintAddress,
        vault.authorityAddress,
        true,
        tokenProgramId,
      );
      if (createVaultTokenInstruction) instructions.push(createVaultTokenInstruction);

      const { instruction: createBeneficiaryTokenInstruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(
          mintAddress,
          vault.beneficiaryAddress,
          true,
          tokenProgramId,
        );
      if (createBeneficiaryTokenInstruction) instructions.push(createBeneficiaryTokenInstruction);
    }

    if (!instructions.length) return null;

    return this.sendSmartTransaction(instructions, [], altAccounts, priorityLevel, maxPriorityMicroLamports, simulate);
  }

  async changeBeneficiary({
    vault,
    beneficiaryAddress,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{ vault: Vault; beneficiaryAddress: PublicKey }>): Promise<TransactionSignature> {
    const instruction = await this.program.methods
      .changeBeneficiary(beneficiaryAddress)
      .accountsStrict({
        admin: vault.adminAddress,
        vault: vault.address,
      })
      .instruction();

    return this.sendSmartTransaction([instruction], [], altAccounts, priorityLevel, maxPriorityMicroLamports, simulate);
  }

  async transferAdmin({
    vault,
    adminAddress,
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{ vault: Vault; adminAddress: PublicKey }>): Promise<TransactionSignature> {
    const instruction = await this.program.methods
      .transferAdmin(adminAddress)
      .accountsStrict({
        admin: vault.adminAddress,
        vault: vault.address,
      })
      .instruction();

    return this.sendSmartTransaction([instruction], [], altAccounts, priorityLevel, maxPriorityMicroLamports, simulate);
  }

  async createPriceFeed({
    vault,
    mintAddress,
    pythPriceAddress,
    pythPriceFeedId,
    keypair = Keypair.generate(),
    altAccounts,
    priorityLevel,
    maxPriorityMicroLamports,
    simulate,
  }: TransactionArgs<{
    vault: Vault;
    pythPriceAddress: PublicKey;
    mintAddress: PublicKey;
    pythPriceFeedId: string;
    keypair?: Keypair;
  }>): Promise<AddressWithTransactionSignature> {
    const address = keypair.publicKey;

    const instructions: TransactionInstruction[] = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: address,
        space: this.program.account.priceFeed.size,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(this.program.account.priceFeed.size),
        programId: this.program.programId,
      }),
      await this.program.methods
        .createPriceFeed(pythPriceFeedId)
        .accountsStrict({
          adminOnly: {
            admin: vault.adminAddress,
            vault: vault.address,
          },
          priceFeed: address,
          priceUpdate: pythPriceAddress,
          mint: mintAddress,
        })
        .instruction(),
    ];

    const signature = await this.sendSmartTransaction(
      instructions,
      [keypair],
      altAccounts,
      priorityLevel,
      maxPriorityMicroLamports,
      simulate,
    );

    return { address, signature };
  }
}

export class VaultListener {
  private _listener?: number;

  constructor(readonly program: VaultProgram) {}

  addVaultListener(callback: (event: DataUpdatedEvent<Partial<VaultData>>) => void) {
    this.removeVaultListener();
    this._listener = this.program.addEventListener(
      "vaultUpdatedEvent",
      (event: DataUpdatedEvent<Partial<VaultData>>, _slot: number, signature: TransactionSignature) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  removeVaultListener() {
    if (this._listener !== undefined) {
      this.program.removeEventListener(this._listener);
      delete this._listener;
    }
  }
}
