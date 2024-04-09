import { BN, Program, Provider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { DataUpdatedEvent, SIMULATED_SIGNATURE, WalletContext } from "@stabbleorg/anchor-contrib";
import { Vault, VaultData } from "../accounts";
import { type Vault as IDLType, IDL } from "../generated/vault";

export type VaultProgram = Program<IDLType>;

export class VaultContext<T extends Provider> extends WalletContext<T> {
  readonly program: VaultProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("6sTpp3Z7s4YSWgxuibjhE8tvcywhRc8a5FYfuv6vhuQA"),
      provider,
    );
  }

  findVaultAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Vault Authority"), vaultAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  async findOne(vaultAddress: PublicKey): Promise<Vault> {
    const data = await this.program.account.vault.fetch(vaultAddress);
    return new Vault(vaultAddress, data);
  }

  async findMany(vaultAddresses: PublicKey[]): Promise<Vault[]> {
    return (await this.program.account.vault.fetchMultiple(vaultAddresses)).map(
      (data, index) => new Vault(vaultAddresses[index], data!),
    );
  }

  async findAll(): Promise<Vault[]> {
    const accounts = await this.program.account.vault.all();
    return accounts.map((data) => new Vault(data.publicKey, data.account));
  }

  async initializeInstructions({
    vaultAddress,
    withdrawAuthorityAddress,
    withdrawAuthorityBump,
    beneficiaryAddress,
    beneficiaryFee,
  }: {
    vaultAddress: PublicKey;
    withdrawAuthorityAddress: PublicKey;
    withdrawAuthorityBump: number;
    beneficiaryAddress: PublicKey;
    beneficiaryFee: BN;
  }): Promise<TransactionInstruction[]> {
    return [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: vaultAddress,
        space: this.program.account.vault.size,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(this.program.account.vault.size),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(withdrawAuthorityAddress, withdrawAuthorityBump, beneficiaryAddress, beneficiaryFee)
        .accounts({
          admin: this.walletAddress,
          vault: vaultAddress,
          vaultAuthority: this.findVaultAuthorityAddress(vaultAddress),
        })
        .instruction(),
    ];
  }
}

export class VaultListener {
  private _listener?: number;

  constructor(readonly program: VaultProgram) {}

  addVaultListener(callback: (event: DataUpdatedEvent<Partial<VaultData>>) => void) {
    this.removeVaultListener();
    this._listener = this.program.addEventListener(
      "VaultUpdatedEvent",
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
