import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { type Vault as IDLType, IDL } from "../generated/vault";
import { WalletContext } from "../wallet";
import { Vault } from "../models";
import { TokenAmountUtil } from "../utils";

export type VaultProgram = Program<IDLType>;

export class VaultContext<T extends Provider> extends WalletContext<T> {
  readonly program: VaultProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("7oh6tTdSfoWdKgqFXotGtPfS3Gqk6Jwc2yDZ7NCErYLW"),
      provider,
    );
  }

  findVaultAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Vault Authority"), vaultAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  async loadVault(vaultAddress: PublicKey): Promise<Vault> {
    const data = await this.program.account.vault.fetch(vaultAddress);
    return new Vault(vaultAddress, data);
  }

  async loadVaults(vaultAddresses: PublicKey[]): Promise<Vault[]> {
    return (await this.program.account.vault.fetchMultiple(vaultAddresses)).map(
      (data, index) => new Vault(vaultAddresses[index], data!),
    );
  }

  async initializeInstructions(
    vaultAddress: PublicKey,
    withdrawAuthorityAddress: PublicKey,
    withdrawAuthorityBump: number,
    beneficiaryAddress: PublicKey,
    beneficiaryFee: string,
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
        .initialize(
          withdrawAuthorityAddress,
          withdrawAuthorityBump,
          beneficiaryAddress,
          TokenAmountUtil.toBigAmount(beneficiaryFee, 4).toNumber(),
        )
        .accounts({
          admin: this.walletAddress,
          vault: vaultAddress,
          vaultAuthority: this.findVaultAuthorityAddress(vaultAddress),
        })
        .instruction(),
    ];
  }

  async assertTokenBalanceInstructions(tokenAddress: PublicKey, minBalance: BN): Promise<TransactionInstruction[]> {
    return [await this.program.methods.assertTokenBalance(minBalance).accounts({ token: tokenAddress }).instruction()];
  }
}
