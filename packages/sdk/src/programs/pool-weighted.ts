import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { AccountMeta, PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { DataUpdatedEvent, SIMULATED_SIGNATURE, WalletContext } from "@stabbleorg/anchor-contrib";
import { WeightedPool, WeightedPoolData } from "../accounts";
import { type PoolWeighted as IDLType, IDL } from "../generated/pool_weighted";

export type WeightedPoolProgram = Program<IDLType>;

export class WeightedPoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: WeightedPoolProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("MT29MUjo7TPYxWK2NjLUCQ32dFgYEGW3nEDSAAJbyVy"),
      provider,
    );
  }

  findPoolAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Weighted Pool Authority"), poolAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  findWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return this.findWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  findWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Withdraw Authority"), vaultAddress.toBuffer()],
      this.program.programId,
    );
  }

  async findOne(poolAddress: PublicKey): Promise<WeightedPool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new WeightedPool(poolAddress, data);
  }

  async findMany(poolAddresses: PublicKey[]): Promise<WeightedPool[]> {
    return (await this.program.account.pool.fetchMultiple(poolAddresses)).map(
      (data, index) => new WeightedPool(poolAddresses[index], data!),
    );
  }

  async findManyByVault(vaultAddress: PublicKey): Promise<WeightedPool[]> {
    const accounts = await this.program.account.pool.all([
      {
        memcmp: {
          offset: 40, // 8+32
          bytes: vaultAddress.toBase58(),
        },
      },
    ]);
    return accounts.map((data) => new WeightedPool(data.publicKey, data.account));
  }

  async findAll(): Promise<WeightedPool[]> {
    const accounts = await this.program.account.pool.all();
    return accounts.map((data) => new WeightedPool(data.publicKey, data.account));
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
    let closeWSOLAccountIX: TransactionInstruction | null = null;

    const { address: userTokenInAddress, instruction: userTokenInInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(mintInAddress);
    if (userTokenInInstruction) {
      instructions.push(userTokenInInstruction);
      if (mintInAddress.equals(NATIVE_MINT)) {
        closeWSOLAccountIX = createCloseAccountInstruction(userTokenInAddress, this.walletAddress, this.walletAddress);
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: this.walletAddress,
            toPubkey: userTokenInAddress,
            lamports: BigInt(amountIn.toString()),
          }),
          createSyncNativeInstruction(userTokenInAddress),
        );
      }
    }

    const { address: userTokenOutAddress, instruction: userTokenOutInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress);
    if (userTokenOutInstruction) {
      instructions.push(userTokenOutInstruction);
      if (mintOutAddress.equals(NATIVE_MINT)) {
        closeWSOLAccountIX = createCloseAccountInstruction(userTokenOutAddress, this.walletAddress, this.walletAddress);
      }
    }

    const { address: beneficiaryTokenOutAddress, instruction: beneficiaryTokenOutInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress, beneficiaryAddress);
    if (beneficiaryTokenOutInstruction) instructions.push(beneficiaryTokenOutInstruction);

    instructions.push(
      await this.program.methods
        .swap(amountIn, minimumAmountOut)
        .accounts({
          user: this.walletAddress,
          userTokenIn: userTokenInAddress,
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

    if (closeWSOLAccountIX) instructions.push(closeWSOLAccountIX);

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
    let closeWSOLAccountIX: TransactionInstruction | null = null;

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

      if (mintAddress.equals(NATIVE_MINT)) {
        const { instruction } = await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
        if (instruction) {
          instructions.push(instruction); // create WSOL token account
          closeWSOLAccountIX = createCloseAccountInstruction(userTokenAddress, this.walletAddress, this.walletAddress);
        }
        const index = mintAddresses.indexOf(mintAddress);
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: this.walletAddress,
            toPubkey: userTokenAddress,
            lamports: BigInt(amounts[index].toString()),
          }),
          createSyncNativeInstruction(userTokenAddress),
        );
      }
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

    if (closeWSOLAccountIX) instructions.push(closeWSOLAccountIX);

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
    let closeWSOLAccountIX: TransactionInstruction | null = null;

    const userPoolTokenAddress = this.getAssociatedTokenAddress(poolMintAddress);

    for (const mintAddress of mintAddresses) {
      const { address: userTokenAddress, instruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
      const vaultTokenAddress = this.getAssociatedTokenAddress(mintAddress, vaultAuthorityAddress);
      if (instruction) {
        instructions.push(instruction);
        if (mintAddress.equals(NATIVE_MINT)) {
          closeWSOLAccountIX = createCloseAccountInstruction(userTokenAddress, this.walletAddress, this.walletAddress);
        }
      }
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

    if (closeWSOLAccountIX) instructions.push(closeWSOLAccountIX);

    return instructions;
  }

  async initializeInstructions({
    vaultAddress,
    poolAddress,
    poolMintAddress,
    mintAddresses,
    swapFee,
    weights,
    ticks,
  }: {
    vaultAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    mintAddresses: PublicKey[];
    swapFee: number;
    weights: number[];
    ticks: BN[];
  }): Promise<TransactionInstruction[]> {
    const poolAccountSize = this.program.account.pool.size + WeightedPool.POOL_TOKEN_SIZE * mintAddresses.length + 4;
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
        .initialize(swapFee, weights, ticks)
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
    newSwapFee: number;
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

export class WeightedPoolListener {
  private _listener?: number;

  constructor(readonly program: WeightedPoolProgram) {}

  addPoolListener(callback: (event: DataUpdatedEvent<Partial<WeightedPoolData>>) => void) {
    this.removePoolListener();
    this._listener = this.program.addEventListener(
      "PoolUpdatedEvent",
      (event: DataUpdatedEvent<Partial<WeightedPoolData>>, _slot: number, signature: TransactionSignature) => {
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
