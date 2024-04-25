import BN from "bn.js";
import { Program, Provider } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  MintLayout,
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
import {
  DataUpdatedEvent,
  SIMULATED_SIGNATURE,
  TransactionArgsWithPriority,
  WalletContext,
} from "@stabbleorg/anchor-contrib";
import { AMM_VAULT_ID, StablePool, StablePoolData, Vault } from "../accounts";
import { FloatLike, SafeNumber } from "../utils";
import { type StableSwap as IDLType } from "../generated/stable_swap";
import IDL from "../generated/idl/stable_swap.json";

export class StableSwapContext<T extends Provider> extends WalletContext<T> {
  readonly program: Program<IDLType>;
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
  }: TransactionArgsWithPriority<{
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

    const { transaction, slot } = await this.createTransaction(instructions);

    const signature = await this.provider.sendAndConfirm!(transaction, [keypair, poolMintKP], { minContextSlot: slot });
    const pool = new StablePool(vault, keypair.publicKey, await this.program.account.pool.fetch(keypair.publicKey));

    return { pool, signature };
  }

  async deposit({
    pool,
    mintAddresses,
    amounts,
    minimumAmountOut,
  }: TransactionArgsWithPriority<{
    pool: StablePool;
    mintAddresses: PublicKey[];
    amounts: FloatLike[];
    minimumAmountOut?: FloatLike;
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const { address: userPoolTokenAddress, instruction: createUserPoolTokenInstruction } =
      await this.getOrCreateAssociatedTokenAddressInstruction(pool.mintAddress);
    if (createUserPoolTokenInstruction) instructions.push(createUserPoolTokenInstruction);

    for (const mintAddress of mintAddresses) {
      const userTokenAddress = this.getAssociatedTokenAddress(mintAddress);
      userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });

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

    const { transaction, slot } = await this.createTransaction(instructions);

    return this.provider.sendAndConfirm!(transaction, [], { minContextSlot: slot });
  }

  async withdraw({
    pool,
    mintAddresses,
    amount,
    minimumAmountsOut,
  }: TransactionArgsWithPriority<{
    pool: StablePool;
    mintAddresses: PublicKey[];
    amount: FloatLike;
    minimumAmountsOut: FloatLike[];
  }>): Promise<TransactionSignature> {
    const instructions: TransactionInstruction[] = [];
    const userRemainingAccounts: AccountMeta[] = [];
    const vaultRemainingAccounts: AccountMeta[] = [];

    const userPoolTokenAddress = this.getAssociatedTokenAddress(pool.mintAddress);

    for (const mintAddress of mintAddresses) {
      const { address: userTokenAddress, instruction: createUserTokenInstruction } =
        await this.getOrCreateAssociatedTokenAddressInstruction(mintAddress);
      if (createUserTokenInstruction) instructions.push(createUserTokenInstruction);
      userRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: userTokenAddress });

      const vaultTokenAddress = pool.vault.getAuthorityTokenAddress(mintAddress);
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
      vaultRemainingAccounts.push({ isSigner: false, isWritable: true, pubkey: vaultTokenAddress });
    }

    instructions.push(
      await this.program.methods
        .withdraw(
          SafeNumber.toBigAmount(amount, StablePool.POOL_TOKEN_DECIMALS),
          minimumAmountsOut.length === mintAddresses.length
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

    const { transaction, slot } = await this.createTransaction(instructions);

    return this.provider.sendAndConfirm!(transaction, [], { minContextSlot: slot });
  }

  // async swapInstructions({
  //   beneficiaryAddress,
  //   vaultAddress,
  //   vaultAuthorityAddress,
  //   vaultProgramAddress,
  //   poolAddress,
  //   mintInAddress,
  //   mintOutAddress,
  //   amountIn,
  //   minimumAmountOut,
  // }: {
  //   beneficiaryAddress: PublicKey;
  //   vaultAddress: PublicKey;
  //   vaultAuthorityAddress: PublicKey;
  //   vaultProgramAddress: PublicKey;
  //   poolAddress: PublicKey;
  //   mintInAddress: PublicKey;
  //   mintOutAddress: PublicKey;
  //   amountIn: BN;
  //   minimumAmountOut: BN;
  // }): Promise<TransactionInstruction[]> {
  //   const instructions: TransactionInstruction[] = [];

  //   const { address: userTokenOutAddress, instruction: userTokenOutInstruction } =
  //     await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress);
  //   if (userTokenOutInstruction) instructions.push(userTokenOutInstruction);

  //   const { address: beneficiaryTokenOutAddress, instruction: beneficiaryTokenOutInstruction } =
  //     await this.getOrCreateAssociatedTokenAddressInstruction(mintOutAddress, beneficiaryAddress);
  //   if (beneficiaryTokenOutInstruction) instructions.push(beneficiaryTokenOutInstruction);

  //   instructions.push(
  //     await this.program.methods
  //       .swap(amountIn, minimumAmountOut)
  //       .accountsStrict({
  //         user: this.walletAddress,
  //         userXToken: null,
  //         userTokenIn: this.getAssociatedTokenAddress(mintInAddress),
  //         userTokenOut: userTokenOutAddress,
  //         vaultTokenIn: this.getAssociatedTokenAddress(mintInAddress, vaultAuthorityAddress),
  //         vaultTokenOut: this.getAssociatedTokenAddress(mintOutAddress, vaultAuthorityAddress),
  //         beneficiaryTokenOut: beneficiaryTokenOutAddress,
  //         pool: poolAddress,
  //         withdrawAuthority: this.findWithdrawAuthorityAddress(vaultAddress),
  //         vault: vaultAddress,
  //         vaultAuthority: vaultAuthorityAddress,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         vaultProgram: vaultProgramAddress,
  //       })
  //       .instruction(),
  //   );

  //   return instructions;
  // }

  async changeAmpFactor({
    pool,
    adminKP,
  }: TransactionArgsWithPriority<{ pool: StablePool; adminKP?: Keypair }>): Promise<TransactionSignature> {
    const instruction = await this.program.methods
      .pause()
      .accountsStrict({
        owner: this.walletAddress,
        pool: pool.address,
      })
      .instruction();

    const signers: Signer[] = [];
    if (adminKP) signers.push(adminKP);

    const { transaction, slot } = await this.createTransaction([instruction]);

    return this.provider.sendAndConfirm!(transaction, signers, { minContextSlot: slot });
  }
}

export class StableSwapListener {
  private _listener?: number;

  constructor(readonly program: Program<IDLType>) {}

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
