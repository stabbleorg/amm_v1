import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AccountMeta, PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { DataUpdatedEvent, SIMULATED_SIGNATURE, WalletContext } from "@stabbleorg/anchor-contrib";
import { StablePool, StablePoolData } from "../accounts";
import { type PoolStable as IDLType, IDL } from "../generated/pool_stable";

export type StablePoolProgram = Program<IDLType>;

export class StablePoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: StablePoolProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("EeyyyuAXAzo3YuMv7REuHYtPzEssgK4oBeFYM8K9CoGM"),
      provider,
    );
  }

  findPoolAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), poolAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  findWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return this.findWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  findWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdraw_authority"), vaultAddress.toBuffer()],
      this.program.programId,
    );
  }

  async findOne(poolAddress: PublicKey): Promise<StablePool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new StablePool(poolAddress, data);
  }

  async findMany(poolAddresses: PublicKey[]): Promise<StablePool[]> {
    return (await this.program.account.pool.fetchMultiple(poolAddresses)).map(
      (data, index) => new StablePool(poolAddresses[index], data!),
    );
  }

  async findManyByVault(vaultAddress: PublicKey): Promise<StablePool[]> {
    const accounts = await this.program.account.pool.all([
      {
        memcmp: {
          offset: 40, // 8+32
          bytes: vaultAddress.toBase58(),
        },
      },
    ]);
    return accounts.map((data) => new StablePool(data.publicKey, data.account));
  }

  async findAll(): Promise<StablePool[]> {
    const accounts = await this.program.account.pool.all();
    return accounts.map((data) => new StablePool(data.publicKey, data.account));
  }

  async swapInstructions({
    beneficiaryAddress,
    vaultAddress,
    vaultAuthorityAddress,
    vaultProgramAddress,
    poolAddress,
    mintInAddress,
    mintOutAddress,
    amountIn,
    minimumAmountOut,
  }: {
    beneficiaryAddress: PublicKey;
    vaultAddress: PublicKey;
    vaultAuthorityAddress: PublicKey;
    vaultProgramAddress: PublicKey;
    poolAddress: PublicKey;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    amountIn: BN;
    minimumAmountOut: BN;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const { address: userTokenOutAddress, instruction: userTokenOutInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress);
    if (userTokenOutInstruction) instructions.push(userTokenOutInstruction);

    const { address: beneficiaryTokenOutAddress, instruction: beneficiaryTokenOutInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress, beneficiaryAddress);
    if (beneficiaryTokenOutInstruction) instructions.push(beneficiaryTokenOutInstruction);

    instructions.push(
      await this.program.methods
        .swap(amountIn, minimumAmountOut)
        .accounts({
          user: this.walletAddress,
          userTokenIn: this.getAssociatedTokenAddress(mintInAddress),
          userTokenOut: userTokenOutAddress,
          vaultTokenIn: this.getAssociatedTokenAddress(mintInAddress, vaultAuthorityAddress),
          vaultTokenOut: this.getAssociatedTokenAddress(mintOutAddress, vaultAuthorityAddress),
          beneficiaryTokenOut: beneficiaryTokenOutAddress,
          pool: poolAddress,
          withdrawAuthority: this.findWithdrawAuthorityAddress(vaultAddress),
          vault: vaultAddress,
          vaultAuthority: vaultAuthorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          vaultProgram: vaultProgramAddress,
        })
        .instruction(),
    );

    return instructions;
  }

  async depositInstructions({
    vaultAddress,
    vaultAuthorityAddress,
    poolAddress,
    poolMintAddress,
    mintAddresses,
    amounts,
    minimumAmountOut,
  }: {
    vaultAddress: PublicKey;
    vaultAuthorityAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    mintAddresses: PublicKey[];
    amounts: BN[];
    minimumAmountOut: BN;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const { address: userPoolTokenAddress, instruction: createUserPoolTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(poolMintAddress);
    if (createUserPoolTokenInstruction) instructions.push(createUserPoolTokenInstruction);

    for (const mintAddress of mintAddresses) {
      const userTokenAddress = this.getAssociatedTokenAddress(mintAddress);
      const { address: vaultTokenAddress, instruction } = await this.getOrCreateAssociatedTokenAddressInstruction(
        mintAddress,
        vaultAuthorityAddress,
      );
      if (instruction) instructions.push(instruction);
      userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
    }

    instructions.push(
      await this.program.methods
        .deposit(amounts, minimumAmountOut)
        .accounts({
          user: this.walletAddress,
          userPoolToken: userPoolTokenAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          poolAuthority: this.findPoolAuthorityAddress(poolAddress),
          vault: vaultAddress,
          vaultAuthority: vaultAuthorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([...userRemainingAccounts, ...vaultRemainingAccounts])
        .instruction(),
    );

    return instructions;
  }

  async withdrawInstructions({
    vaultAddress,
    vaultAuthorityAddress,
    vaultProgramAddress,
    poolAddress,
    poolMintAddress,
    mintAddresses,
    amount,
    minimumAmountsOut,
  }: {
    vaultAddress: PublicKey;
    vaultAuthorityAddress: PublicKey;
    vaultProgramAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    mintAddresses: PublicKey[];
    amount: BN;
    minimumAmountsOut: BN[];
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const userPoolTokenAddress = this.getAssociatedTokenAddress(poolMintAddress);

    for (const mintAddress of mintAddresses) {
      const { address: userTokenAddress, instruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
      const vaultTokenAddress = this.getAssociatedTokenAddress(mintAddress, vaultAuthorityAddress);
      if (instruction) instructions.push(instruction);
      userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
    }

    instructions.push(
      await this.program.methods
        .withdraw(
          amount,
          minimumAmountsOut.length === mintAddresses.length
            ? minimumAmountsOut
            : Array(mintAddresses.length).fill(new BN(0)),
        )
        .accounts({
          user: this.walletAddress,
          userPoolToken: userPoolTokenAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          withdrawAuthority: this.findWithdrawAuthorityAddress(vaultAddress),
          vault: vaultAddress,
          vaultAuthority: vaultAuthorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
          vaultProgram: vaultProgramAddress,
        })
        .remainingAccounts([...userRemainingAccounts, ...vaultRemainingAccounts])
        .instruction(),
    );

    return instructions;
  }

  async initializeInstructions({
    vaultAddress,
    poolAddress,
    poolMintAddress,
    mintAddresses,
    amp,
    swapFee,
  }: {
    vaultAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    mintAddresses: PublicKey[];
    amp: number;
    swapFee: BN;
  }): Promise<TransactionInstruction[]> {
    const poolAccountSize = this.program.account.pool.size + StablePool.POOL_TOKEN_SIZE * mintAddresses.length + 4 + 32;
    const poolAuthorityAddress = this.findPoolAuthorityAddress(poolAddress);

    return [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: poolAddress,
        space: poolAccountSize,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(poolAccountSize),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(amp, swapFee)
        .accounts({
          owner: this.walletAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          poolAuthority: poolAuthorityAddress,
          withdrawAuthority: this.findWithdrawAuthorityAddress(vaultAddress),
          vault: vaultAddress,
        })
        .remainingAccounts(mintAddresses.map((pubkey) => ({ isSigner: false, isWritable: false, pubkey })))
        .instruction(),
    ];
  }

  async pauseInstructions({ poolAddress }: { poolAddress: PublicKey }): Promise<TransactionInstruction[]> {
    return [
      await this.program.methods
        .pause()
        .accounts({
          owner: this.walletAddress,
          pool: poolAddress,
        })
        .instruction(),
    ];
  }

  async unpauseInstructions({ poolAddress }: { poolAddress: PublicKey }): Promise<TransactionInstruction[]> {
    return [
      await this.program.methods
        .unpause()
        .accounts({
          owner: this.walletAddress,
          pool: poolAddress,
        })
        .instruction(),
    ];
  }

  async changeSwapFeeInstructions({
    poolAddress,
    newSwapFee,
  }: {
    poolAddress: PublicKey;
    newSwapFee: BN;
  }): Promise<TransactionInstruction[]> {
    return [
      await this.program.methods
        .changeSwapFee(newSwapFee)
        .accounts({
          owner: this.walletAddress,
          pool: poolAddress,
        })
        .instruction(),
    ];
  }
}

export class StablePoolListener {
  private _listener?: number;

  constructor(readonly program: StablePoolProgram) {}

  addPoolListener(callback: (event: DataUpdatedEvent<Partial<StablePoolData>>) => void) {
    this.removePoolListener();
    this._listener = this.program.addEventListener(
      "PoolUpdatedEvent",
      (event: DataUpdatedEvent<Partial<StablePoolData>>, _slot: number, signature: TransactionSignature) => {
        if (signature !== SIMULATED_SIGNATURE) {
          callback(event);
        }
      },
    );
  }

  removePoolListener() {
    if (this._listener !== undefined) {
      this.program.removeEventListener(this._listener);
      delete this._listener;
    }
  }
}
