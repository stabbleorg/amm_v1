import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { type Vault as IDLType, IDL } from "../generated/vault";
import { WalletContext } from "../wallet";
import { Vault } from "../accounts";

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

  async initializeInstructions(
    vaultAddress: PublicKey,
    withdrawAuthorityAddress: PublicKey,
    withdrawAuthorityBump: number,
    beneficiaryAddress: PublicKey,
    beneficiaryFee: number,
  ): Promise<TransactionInstruction[]> {
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
  constructor(readonly program: VaultProgram) {}
}
