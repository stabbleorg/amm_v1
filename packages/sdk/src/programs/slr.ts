import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { AuthorityType, TOKEN_PROGRAM_ID, createSetAuthorityInstruction } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { type Slr as IDLType, IDL } from "../generated/slr";
import { WalletContext } from "../wallet";
import { SlrPool } from "../accounts";

export type SlrProgram = Program<IDLType>;
export const SLR_PROGRAM_ID = new PublicKey("88eN7xkpWwyCrtVAuhuKtVLkmuSEFv6MgTkpAodvpd31");
export const SLR_VAULT_AUTHORITY_ADDRESS = new PublicKey("tvmw3gFJvvWnD2SuvGi6vhMkwNNY6sLwYhBy6XhffU6");

export class SlrContext<T extends Provider> extends WalletContext<T> {
  readonly program: SlrProgram;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL, SLR_PROGRAM_ID, provider);
  }

  findPoolAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("SLR Pool Authority"), poolAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  async findOne(poolAddress: PublicKey): Promise<SlrPool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new SlrPool(poolAddress, data);
  }

  async findAll(): Promise<SlrPool[]> {
    return (await this.program.account.pool.all()).map((data) => new SlrPool(data.publicKey, data.account));
  }

  async depositInstructions(
    poolAddress: PublicKey,
    poolMintAddress: PublicKey,
    underlyingMintAddress: PublicKey,
    amount: BN,
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const { address: userPoolTokenAddress, instruction: userPoolTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(poolMintAddress);
    if (userPoolTokenInstruction) instructions.push(userPoolTokenInstruction);

    instructions.push(
      await this.program.methods
        .deposit(amount)
        .accounts({
          user: this.walletAddress,
          userUnderlyingToken: this.getAssociatedTokenAddress(underlyingMintAddress),
          vaultUnderlyingToken: this.getAssociatedTokenAddress(underlyingMintAddress, SLR_VAULT_AUTHORITY_ADDRESS),
          poolToken: userPoolTokenAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          poolAuthority: this.findPoolAuthorityAddress(poolAddress),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return instructions;
  }

  async withdrawInstructions(
    poolAddress: PublicKey,
    poolMintAddress: PublicKey,
    underlyingMintAddress: PublicKey,
    amount: BN,
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const { address: userUnderlyingTokenAddress, instruction: userUnderlyingTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(underlyingMintAddress);
    if (userUnderlyingTokenInstruction) instructions.push(userUnderlyingTokenInstruction);

    instructions.push(
      await this.program.methods
        .withdraw(amount)
        .accounts({
          user: this.walletAddress,
          userUnderlyingToken: userUnderlyingTokenAddress,
          vaultUnderlyingToken: this.getAssociatedTokenAddress(underlyingMintAddress, SLR_VAULT_AUTHORITY_ADDRESS),
          poolToken: this.getAssociatedTokenAddress(poolMintAddress),
          mint: poolMintAddress,
          pool: poolAddress,
          vaultAuthority: SLR_VAULT_AUTHORITY_ADDRESS,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    return instructions;
  }

  async initializeInstructions(
    poolAddress: PublicKey,
    poolMintAddress: PublicKey,
    underlyingMintAddress: PublicKey,
    maxLiquidity: BN,
  ): Promise<TransactionInstruction[]> {
    const poolAccountSize = this.program.account.pool.size + 200;
    const poolAuthorityAddress = this.findPoolAuthorityAddress(poolAddress);

    const instructions = [
      createSetAuthorityInstruction(
        poolMintAddress,
        this.walletAddress,
        AuthorityType.MintTokens,
        poolAuthorityAddress,
      ),
      createSetAuthorityInstruction(poolMintAddress, this.walletAddress, AuthorityType.FreezeAccount, null),
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: poolAddress,
        space: poolAccountSize,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(poolAccountSize),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(maxLiquidity)
        .accounts({
          admin: this.walletAddress,
          mint: poolMintAddress,
          underlyingMint: underlyingMintAddress,
          pool: poolAddress,
          poolAuthority: poolAuthorityAddress,
        })
        .instruction(),
    ];

    const { address, instruction: vaultUnderlyingTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(underlyingMintAddress, SLR_VAULT_AUTHORITY_ADDRESS);
    if (vaultUnderlyingTokenInstruction) instructions.push(vaultUnderlyingTokenInstruction);

    return instructions;
  }
}

export class SlrListener {
  constructor(readonly program: SlrProgram) {}
}
