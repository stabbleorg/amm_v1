import { Program, Provider } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import {
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
  TransactionArgsWithPriority,
  WalletContext,
} from "@stabbleorg/anchor-contrib";
import { StablePool, Vault, VaultData, WeightedPool } from "../accounts";
import { SafeNumber } from "../utils";
import { type Vault as IDLType } from "../generated/vault";
import IDL from "../generated/idl/vault.json";

export type PoolKind = "stable_swap" | "weighted_swap";

export class VaultContext<T extends Provider> extends WalletContext<T> {
  readonly program: Program<IDLType>;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL as any, provider);
  }

  async findOne(vaultAddress: PublicKey): Promise<Vault> {
    const account = await this.program.account.vault.fetch(vaultAddress);
    return new Vault(vaultAddress, account);
  }

  async findAll(): Promise<Vault[]> {
    const accounts = await this.program.account.vault.all();
    return accounts.map((data) => new Vault(data.publicKey, data.account));
  }

  async initialize({
    keypair = Keypair.generate(),
    beneficiaryAddress,
    beneficiaryFee,
    kind,
  }: TransactionArgsWithPriority<{
    keypair?: Keypair;
    beneficiaryAddress: PublicKey;
    beneficiaryFee: number;
    kind: PoolKind;
  }>): Promise<TransactionSignature> {
    let withdrawAuthorityAddress: PublicKey;
    let withdrawAuthorityBump: number;

    switch (kind) {
      case "stable_swap":
        [withdrawAuthorityAddress, withdrawAuthorityBump] = StablePool.getWithdrawAuthorityAddressAndBump(
          keypair.publicKey,
        );
        break;
      case "weighted_swap":
      default:
        [withdrawAuthorityAddress, withdrawAuthorityBump] = WeightedPool.getWithdrawAuthorityAddressAndBump(
          keypair.publicKey,
        );
        break;
    }

    const instructions = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: keypair.publicKey,
        space: this.program.account.vault.size,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(this.program.account.vault.size),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(
          withdrawAuthorityAddress,
          withdrawAuthorityBump,
          beneficiaryAddress,
          SafeNumber.toBasisPoints(beneficiaryFee),
        )
        .accountsStrict({
          admin: this.walletAddress,
          vault: keypair.publicKey,
          vaultAuthority: Vault.getAuthorityAddress(keypair.publicKey),
        })
        .instruction(),
    ];

    const { transaction, slot } = await this.createTransaction(instructions);

    return this.provider.sendAndConfirm!(transaction, [keypair], { minContextSlot: slot });
  }

  async createMissingTokenAccounts({
    vault,
    mintAddresses,
  }: TransactionArgsWithPriority<{
    vault: Vault;
    mintAddresses: PublicKey[];
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    for (const mintAddress of mintAddresses) {
      const { instruction: createVaultTokenInstruction } = await this.getOrCreateAssociatedTokenAddressInstruction(
        mintAddress,
        vault.authorityAddress,
        true,
      );
      if (createVaultTokenInstruction) instructions.push(createVaultTokenInstruction);

      const { instruction: createBeneficiaryTokenInstruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress, vault.beneficiaryAddress, true);
      if (createBeneficiaryTokenInstruction) instructions.push(createBeneficiaryTokenInstruction);
    }
    const { transaction, slot } = await this.createTransaction(instructions);

    return this.provider.sendAndConfirm!(transaction, [], { minContextSlot: slot });
  }
}

export class VaultListener {
  private _listener?: number;

  constructor(readonly program: Program<IDLType>) {}

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
