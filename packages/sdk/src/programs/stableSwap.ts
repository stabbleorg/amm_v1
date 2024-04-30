import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  MintLayout,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createSetAuthorityInstruction,
} from "@solana/spl-token";
import {
  AccountMeta,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { DataUpdatedEvent, SIMULATED_SIGNATURE, TransactionArgs, WalletContext } from "@stabbleorg/anchor-contrib";
import { AMM_VAULT_ID, Vault, StablePool, StablePoolData } from "../accounts";
import { FloatLike, SafeNumber } from "../utils";
import { type StableSwap as IDLType } from "../generated/stable_swap";
import IDL from "../generated/idl/stable_swap.json";

export type StableSwapProgram = Program<IDLType>;

export class StableSwapContext<T extends Provider> extends WalletContext<T> {
  readonly program: StableSwapProgram;
  readonly metaplex: Metaplex;

  constructor(provider: T) {
    super(provider);
    this.program = new Program(IDL as any, provider);
    this.metaplex = Metaplex.make(provider.connection);
  }

  async findByVault(vault: Vault): Promise<StablePool[]> {
    const accounts = await this.program.account.pool.all([
      {
        memcmp: {
          offset: 40, // 8 + 32
          bytes: vault.address.toBase58(),
        },
      },
    ]);
    return accounts.map((data) => new StablePool(vault, data.publicKey, data.account));
  }

  async initialize({
    vault,
    keypair = Keypair.generate(),
    poolMintKP = Keypair.generate(),
    mintAddresses,
    maxCaps,
    ampFactor,
    swapFee,
    name = "",
    symbol = "",
    uri = "",
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{
    vault: Vault;
    keypair?: Keypair;
    poolMintKP?: Keypair;
    mintAddresses: PublicKey[];
    maxCaps: FloatLike[];
    ampFactor: number;
    swapFee: FloatLike;
    name?: string;
    symbol?: string;
    uri?: string;
  }>): Promise<{ pool: StablePool; signature: TransactionSignature }> {
    const size = this.program.account.pool.size + StablePool.POOL_TOKEN_SIZE * mintAddresses.length + 4;
    const poolAuthorityAddress = StablePool.getAuthorityAddress(keypair.publicKey);

    const instructions = [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: poolMintKP.publicKey,
        space: MintLayout.span,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        poolMintKP.publicKey,
        StablePool.POOL_TOKEN_DECIMALS,
        this.walletAddress,
        this.walletAddress,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: this.metaplex.nfts().pdas().metadata({ mint: poolMintKP.publicKey }),
          mint: poolMintKP.publicKey,
          mintAuthority: this.walletAddress,
          payer: this.walletAddress,
          updateAuthority: this.walletAddress,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name,
              symbol,
              uri,
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        },
      ),
      createSetAuthorityInstruction(
        poolMintKP.publicKey,
        this.walletAddress,
        AuthorityType.MintTokens,
        poolAuthorityAddress,
      ),
      createSetAuthorityInstruction(poolMintKP.publicKey, this.walletAddress, AuthorityType.FreezeAccount, null),
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: keypair.publicKey,
        space: size,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(size),
        programId: this.program.programId,
      }),
      await this.program.methods
        .initialize(
          ampFactor,
          SafeNumber.toBasisPoints(swapFee),
          maxCaps.map((maxCap) => new BN(maxCap)),
        )
        .accountsStrict({
          owner: this.walletAddress,
          mint: poolMintKP.publicKey,
          pool: keypair.publicKey,
          poolAuthority: poolAuthorityAddress,
          withdrawAuthority: vault.withdrawAuthorityAddress,
          vault: vault.address,
        })
        .remainingAccounts(mintAddresses.map((pubkey) => ({ isSigner: false, isWritable: false, pubkey })))
        .instruction(),
    ];

    const { transaction, recentBlock, slot } = await this.createTransaction(instructions, altAccounts, priorityLevel);

    const signature = await this.sendAndConfirmTransaction(transaction, recentBlock, slot, [keypair, poolMintKP]);

    const pool = new StablePool(vault, keypair.publicKey, await this.program.account.pool.fetch(keypair.publicKey));

    return { pool, signature };
  }

  async deposit({
    pool,
    mintAddresses,
    amounts,
    minimumAmountOut,
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{
    pool: StablePool;
    mintAddresses: PublicKey[];
    amounts: FloatLike[];
    minimumAmountOut?: FloatLike;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const { address: userPoolTokenAddress, instruction: createUserPoolTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(pool.mintAddress);
    if (createUserPoolTokenInstruction) instructions.push(createUserPoolTokenInstruction);

    for (const [index, mintAddress] of mintAddresses.entries()) {
      if (mintAddress.equals(NATIVE_MINT)) {
        const keypair = Keypair.generate();
        signers.push(keypair);
        instructions.push(...(await this.transferWSOLInstructions(keypair.publicKey, amounts[index])));
        userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: keypair.publicKey });
      } else {
        const userTokenAddress = this.getAssociatedTokenAddress(mintAddress);
        userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });
      }

      const vaultTokenAddress = pool.vault.getAuthorityTokenAddress(mintAddress);
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
    }

    instructions.push(
      await this.program.methods
        .deposit(
          amounts.map((amount, index) =>
            SafeNumber.toBigAmount(
              amount,
              pool.data.tokens.find((data) => data.mint.equals(mintAddresses[index]))!.decimals,
            ),
          ),
          SafeNumber.toBigAmount(minimumAmountOut || 0, StablePool.POOL_TOKEN_DECIMALS),
        )
        .accountsStrict({
          user: this.walletAddress,
          userPoolToken: userPoolTokenAddress,
          mint: pool.mintAddress,
          pool: pool.address,
          poolAuthority: pool.authorityAddress,
          vault: pool.vault.address,
          vaultAuthority: pool.vault.authorityAddress,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([...userRemainingAccounts, ...vaultRemainingAccounts])
        .instruction(),
    );

    if (signers.length) instructions.push(this.closeIntermediateTokenAccountInstruction(signers[0].publicKey));

    const { transaction, recentBlock, slot } = await this.createTransaction(instructions, altAccounts, priorityLevel);

    return this.sendAndConfirmTransaction(transaction, recentBlock, slot, signers);
  }

  async withdraw({
    pool,
    mintAddresses,
    amount,
    minimumAmountsOut,
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{
    pool: StablePool;
    mintAddresses: PublicKey[];
    amount: FloatLike;
    minimumAmountsOut?: FloatLike[];
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const userPoolTokenAddress = this.getAssociatedTokenAddress(pool.mintAddress);

    for (const mintAddress of mintAddresses) {
      if (mintAddress.equals(NATIVE_MINT)) {
        const keypair = Keypair.generate();
        signers.push(keypair);
        instructions.push(...(await this.createIntermediateTokenAccountInstructions(keypair.publicKey, mintAddress)));
        userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: keypair.publicKey });
      } else {
        const { address: userTokenAddress, instruction: createUserTokenInstruction } =
          await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
        if (createUserTokenInstruction) instructions.push(createUserTokenInstruction);
        userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });
      }

      const vaultTokenAddress = pool.vault.getAuthorityTokenAddress(mintAddress);
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
    }

    instructions.push(
      await this.program.methods
        .withdraw(
          SafeNumber.toBigAmount(amount, StablePool.POOL_TOKEN_DECIMALS),
          minimumAmountsOut !== undefined
            ? minimumAmountsOut.map((amount, index) =>
                SafeNumber.toBigAmount(
                  amount,
                  pool.data.tokens.find((data) => data.mint.equals(mintAddresses[index]))!.decimals,
                ),
              )
            : Array(mintAddresses.length).fill(new BN(0)),
        )
        .accountsStrict({
          user: this.walletAddress,
          userPoolToken: userPoolTokenAddress,
          mint: pool.mintAddress,
          pool: pool.address,
          withdrawAuthority: pool.vault.withdrawAuthorityAddress,
          vault: pool.vault.address,
          vaultAuthority: pool.vault.authorityAddress,
          vaultProgram: AMM_VAULT_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([...userRemainingAccounts, ...vaultRemainingAccounts])
        .instruction(),
    );

    if (signers.length) instructions.push(this.closeIntermediateTokenAccountInstruction(signers[0].publicKey));

    const { transaction, recentBlock, slot } = await this.createTransaction(instructions, altAccounts, priorityLevel);

    return this.sendAndConfirmTransaction(transaction, recentBlock, slot, signers);
  }

  async swap({
    pool,
    mintInAddress,
    mintOutAddress,
    amountIn,
    minimumAmountOut,
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{
    pool: StablePool;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    amountIn: FloatLike;
    minimumAmountOut: FloatLike;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    let tokenInAddress;
    if (mintInAddress.equals(NATIVE_MINT)) {
      const keypair = Keypair.generate();
      instructions.push(...(await this.transferWSOLInstructions(keypair.publicKey, amountIn)));
      signers.push(keypair);
      tokenInAddress = keypair.publicKey;
    }

    let tokenOutAddress;
    if (mintOutAddress.equals(NATIVE_MINT)) {
      const keypair = Keypair.generate();
      signers.push(keypair);
      instructions.push(...(await this.createIntermediateTokenAccountInstructions(keypair.publicKey, mintOutAddress)));
      signers.push(keypair);
      tokenOutAddress = keypair.publicKey;
    }

    instructions.push(
      ...(await this.swapInstructions({
        pool,
        mintInAddress,
        mintOutAddress,
        amountIn,
        minimumAmountOut,
        tokenInAddress,
        tokenOutAddress,
      })),
    );

    const { transaction, recentBlock, slot } = await this.createTransaction(instructions, altAccounts, priorityLevel);

    return this.sendAndConfirmTransaction(transaction, recentBlock, slot, signers);
  }

  async swapInstructions({
    pool,
    mintInAddress,
    mintOutAddress,
    tokenInAddress,
    tokenOutAddress,
    amountIn,
    minimumAmountOut,
  }: {
    pool: StablePool;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    tokenInAddress?: PublicKey;
    tokenOutAddress?: PublicKey;
    amountIn?: FloatLike;
    minimumAmountOut?: FloatLike;
  }): Promise<TransactionInstruction[]> {
    const tokenIn = pool.tokens.find((token) => token.mintAddress.equals(mintInAddress));
    if (!tokenIn) throw Error("Swap path not found");
    const tokenOut = pool.tokens.find((token) => token.mintAddress.equals(mintOutAddress));
    if (!tokenOut) throw Error("Swap path not found");

    const instructions: TransactionInstruction[] = [];

    let userTokenInAddress: PublicKey;
    if (tokenInAddress) {
      userTokenInAddress = tokenInAddress;
    } else {
      const { address: userTokenAddress, instruction: createUserTokenInstruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintInAddress);
      if (createUserTokenInstruction) {
        instructions.push(createUserTokenInstruction);
      }
      userTokenInAddress = userTokenAddress;
    }

    let userTokenOutAddress: PublicKey;
    if (tokenOutAddress) {
      userTokenOutAddress = tokenOutAddress;
    } else {
      const { address: userTokenAddress, instruction: createUserTokenInstruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress);
      if (createUserTokenInstruction) {
        instructions.push(createUserTokenInstruction);
      }
      userTokenOutAddress = userTokenAddress;
    }

    instructions.push(
      await this.program.methods
        .swap(
          amountIn ? SafeNumber.toBigAmount(amountIn, tokenIn.balance.decimals) : null,
          SafeNumber.toBigAmount(minimumAmountOut || 0, tokenOut.balance.decimals),
        )
        .accountsStrict({
          user: this.walletAddress,
          // TODO: assign xSTB token account for swap fee discount
          userXToken: null,
          userTokenIn: userTokenInAddress,
          userTokenOut: userTokenOutAddress,
          vaultTokenIn: pool.vault.getAuthorityTokenAddress(mintInAddress),
          vaultTokenOut: pool.vault.getAuthorityTokenAddress(mintOutAddress),
          beneficiaryTokenOut: pool.vault.getBeneficiaryTokenAddress(mintOutAddress),
          pool: pool.address,
          withdrawAuthority: pool.vault.withdrawAuthorityAddress,
          vault: pool.vault.address,
          vaultAuthority: pool.vault.authorityAddress,
          vaultProgram: AMM_VAULT_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    // close intermediate token accounts
    if (tokenInAddress) instructions.push(this.closeIntermediateTokenAccountInstruction(tokenInAddress));
    if (tokenOutAddress && minimumAmountOut !== undefined)
      instructions.push(this.closeIntermediateTokenAccountInstruction(tokenOutAddress));

    return instructions;
  }

  async changeAmpFactor({
    pool,
    ampFactor,
    rampDuration,
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{ pool: StablePool; ampFactor: number; rampDuration: number }>): Promise<TransactionSignature> {
    const instruction = await this.program.methods
      .changeAmpFactor(ampFactor, rampDuration)
      .accountsStrict({
        owner: this.walletAddress,
        pool: pool.address,
      })
      .instruction();

    const { transaction, recentBlock, slot } = await this.createTransaction([instruction], altAccounts, priorityLevel);

    return this.sendAndConfirmTransaction(transaction, recentBlock, slot);
  }
}

export class StableSwapListener {
  private _listener?: number;

  constructor(readonly program: StableSwapProgram) {}

  addPoolListener(callback: (event: DataUpdatedEvent<Partial<StablePoolData>>) => void) {
    this.removePoolListener();
    this._listener = this.program.addEventListener(
      "poolUpdatedEvent",
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
