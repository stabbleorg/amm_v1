import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { DataUpdatedEvent, SIMULATED_SIGNATURE, WalletContext } from "@stabbleorg/anchor-contrib";
import { SmartPool, SmartPoolData } from "../accounts";
import { type PoolSmart as IDLType } from "../generated/smart_vault";
import IDL from "../generated/idl/smart_vault.json";

export class SmartPoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: Program<IDLType>;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL as any, provider);
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

  async findOne(poolAddress: PublicKey): Promise<SmartPool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new SmartPool(poolAddress, data);
  }

  async findAll(): Promise<SmartPool[]> {
    const accounts = await this.program.account.pool.all();
    return accounts.map((data) => new SmartPool(data.publicKey, data.account));
  }

  async depositInstructions({
    vaultAddress,
    vaultAuthorityAddress,
    poolAddress,
    poolMintAddress,
    quoteMintAddress,
    amount,
  }: {
    vaultAddress: PublicKey;
    vaultAuthorityAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    quoteMintAddress: PublicKey;
    amount: BN;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const { address: userPoolTokenAddress, instruction: userPoolTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(poolMintAddress);
    if (userPoolTokenInstruction) instructions.push(userPoolTokenInstruction);

    const { address: vaultQuoteTokenAddress, instruction: vaultQuoteTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(quoteMintAddress, vaultAuthorityAddress);
    if (vaultQuoteTokenInstruction) instructions.push(vaultQuoteTokenInstruction);

    instructions.push(
      await this.program.methods
        .deposit(amount)
        .accountsPartial({
          user: this.walletAddress,
          userPoolToken: userPoolTokenAddress,
          userQuoteToken: this.getAssociatedTokenAddress(quoteMintAddress),
          vaultQuoteToken: vaultQuoteTokenAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          poolAuthority: this.findPoolAuthorityAddress(poolAddress),
          vault: vaultAddress,
          vaultAuthority: vaultAuthorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
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
    quoteMintAddress,
    amount,
  }: {
    vaultAddress: PublicKey;
    vaultAuthorityAddress: PublicKey;
    vaultProgramAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    quoteMintAddress: PublicKey;
    amount: BN;
  }): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];

    const { address: userQuoteTokenAddress, instruction: userQuoteTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(quoteMintAddress);
    if (userQuoteTokenInstruction) instructions.push(userQuoteTokenInstruction);

    instructions.push(
      await this.program.methods
        .withdraw(amount)
        .accountsPartial({
          user: this.walletAddress,
          userPoolToken: this.getAssociatedTokenAddress(poolMintAddress),
          userQuoteToken: userQuoteTokenAddress,
          vaultQuoteToken: this.getAssociatedTokenAddress(quoteMintAddress, vaultAuthorityAddress),
          mint: poolMintAddress,
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

  async initializeInstructions({
    vaultAddress,
    poolAddress,
    poolMintAddress,
    quoteMintAddress,
    maxLiquidity,
  }: {
    vaultAddress: PublicKey;
    poolAddress: PublicKey;
    poolMintAddress: PublicKey;
    quoteMintAddress: PublicKey;
    maxLiquidity: BN;
  }): Promise<TransactionInstruction[]> {
    const poolAccountSize = this.program.account.pool.size;
    const poolAuthorityAddress = this.findPoolAuthorityAddress(poolAddress);

    const instructions = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: poolAddress,
        space: poolAccountSize,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(poolAccountSize),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(maxLiquidity)
        .accountsPartial({
          admin: this.walletAddress,
          mint: poolMintAddress,
          quoteMint: quoteMintAddress,
          pool: poolAddress,
          poolAuthority: poolAuthorityAddress,
          withdrawAuthority: this.findWithdrawAuthorityAddress(vaultAddress),
          vault: vaultAddress,
        })
        .instruction(),
    ];

    return instructions;
  }

  async pauseInstructions({ poolAddress }: { poolAddress: PublicKey }): Promise<TransactionInstruction[]> {
    return [
      await this.program.methods
        .pause()
        .accountsPartial({
          admin: this.walletAddress,
          pool: poolAddress,
        })
        .instruction(),
    ];
  }

  async unpauseInstructions({ poolAddress }: { poolAddress: PublicKey }): Promise<TransactionInstruction[]> {
    return [
      await this.program.methods
        .unpause()
        .accountsPartial({
          admin: this.walletAddress,
          pool: poolAddress,
        })
        .instruction(),
    ];
  }

  async closeInstructions({
    poolAddress,
    vaultAddress,
  }: {
    poolAddress: PublicKey;
    vaultAddress: PublicKey;
  }): Promise<TransactionInstruction[]> {
    const instructions = [
      await this.program.methods
        .close()
        .accountsPartial({
          admin: this.walletAddress,
          pool: poolAddress,
          vault: vaultAddress,
        })
        .remainingAccounts([
          {
            pubkey: this.walletAddress,
            isSigner: false,
            isWritable: true,
          },
        ])
        .instruction(),
    ];

    return instructions;
  }
}

export class SmartPoolListener {
  private _listener?: number;

  constructor(readonly program: Program<IDLType>) {}

  addPoolListener(callback: (event: DataUpdatedEvent<Partial<SmartPoolData>>) => void) {
    this.removePoolListener();
    this._listener = this.program.addEventListener(
      "poolUpdatedEvent",
      (event: DataUpdatedEvent<Partial<SmartPoolData>>, _slot: number, signature: TransactionSignature) => {
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
