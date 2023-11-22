import { Provider } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import { MintLayout, TOKEN_PROGRAM_ID, createInitializeMint2Instruction, getMint } from "@solana/spl-token";
import { PublicKey, Keypair, TransactionInstruction, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { StablePoolContext, WeightedPoolContext, VaultContext, SlrContext } from "./programs";
import {
  BasePool,
  StablePool,
  StablePoolData,
  StablePoolToken,
  WeightedPool,
  WeightedPoolData,
  WeightedPoolToken,
  Vault,
  SlrPool,
} from "./accounts";
import { PoolKind } from "./consts";
import { TokenAmountUtil } from "./utils";

export interface ProgramContexts<T extends Provider> {
  slr: SlrContext<T>;
  vault: VaultContext<T>;
  stable: StablePoolContext<T>;
  weighted: WeightedPoolContext<T>;
}

export class SDKWrapper<T extends Provider> {
  constructor(
    readonly contexts: ProgramContexts<T>,
    readonly vaults: Vault[] = [],
  ) {}

  get ctxVault(): VaultContext<T> {
    return this.contexts.vault;
  }

  get ctxStable(): StablePoolContext<T> {
    return this.contexts.stable;
  }

  get ctxWeighted(): WeightedPoolContext<T> {
    return this.contexts.weighted;
  }

  get ctxSlr(): SlrContext<T> {
    return this.contexts.slr;
  }

  async swap({
    pool,
    mintInAddress,
    mintOutAddress,
    amountIn,
    minAmountOut = 0,
  }: {
    pool: BasePool<WeightedPoolToken | StablePoolToken, WeightedPoolData | StablePoolData>;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    amountIn: number | string;
    minAmountOut?: number | string;
  }): Promise<VersionedTransaction> {
    const vault = this.vaults.find((v) => v.address.equals(pool.vaultAddress));
    if (!vault) throw Error("Unkown vault");
    const tokenIn = pool.tokens.find((token) => token.mintAddress.equals(mintInAddress));
    if (!tokenIn) throw Error("Invalid token input");
    const tokenOut = pool.tokens.find((token) => token.mintAddress.equals(mintOutAddress));
    if (!tokenOut) throw Error("Invalid token output");

    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.swapInstructions(
          vault.beneficiaryAddress,
          vault.address,
          this.ctxVault.findVaultAuthorityAddress(vault.address),
          this.ctxVault.program.programId,
          pool.address,
          mintInAddress,
          mintOutAddress,
          TokenAmountUtil.toBigAmount(amountIn, tokenIn.decimals),
          TokenAmountUtil.toBigAmount(minAmountOut, tokenOut.decimals),
        )),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.swapInstructions(
          vault.beneficiaryAddress,
          vault.address,
          this.ctxVault.findVaultAuthorityAddress(vault.address),
          this.ctxVault.program.programId,
          pool.address,
          mintInAddress,
          mintOutAddress,
          TokenAmountUtil.toBigAmount(amountIn, tokenIn.decimals),
          TokenAmountUtil.toBigAmount(minAmountOut, tokenOut.decimals),
        )),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async addLiquidity({
    pool,
    mintAddresses,
    amounts,
  }: {
    pool: BasePool<WeightedPoolToken | StablePoolToken, WeightedPoolData | StablePoolData>;
    mintAddresses: PublicKey[];
    amounts: (string | number)[];
  }): Promise<VersionedTransaction> {
    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.depositInstructions(
          pool.vaultAddress,
          this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          pool.address,
          pool.mintAddress,
          mintAddresses,
          amounts.map((amount, index) =>
            TokenAmountUtil.toBigAmount(
              amount,
              pool.tokens.find((token) => token.mintAddress.equals(mintAddresses[index]))!.decimals,
            ),
          ),
        )),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.depositInstructions(
          pool.vaultAddress,
          this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          pool.address,
          pool.mintAddress,
          mintAddresses,
          amounts.map((amount, index) =>
            TokenAmountUtil.toBigAmount(
              amount,
              pool.tokens.find((token) => token.mintAddress.equals(mintAddresses[index]))!.decimals,
            ),
          ),
        )),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async removeLiquidity({
    pool,
    mintAddresses,
    amount,
  }: {
    pool: BasePool<WeightedPoolToken | StablePoolToken, WeightedPoolData | StablePoolData>;
    mintAddresses: PublicKey[];
    amount: string | number;
  }): Promise<VersionedTransaction> {
    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.withdrawInstructions(
          pool.vaultAddress,
          this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          this.ctxVault.program.programId,
          pool.address,
          pool.mintAddress,
          mintAddresses,
          TokenAmountUtil.toBigAmount(amount, WeightedPool.POOL_TOKEN_DECIMALS),
        )),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.withdrawInstructions(
          pool.vaultAddress,
          this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          this.ctxVault.program.programId,
          pool.address,
          pool.mintAddress,
          mintAddresses,
          TokenAmountUtil.toBigAmount(amount, StablePool.POOL_TOKEN_DECIMALS),
        )),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async createWeightedPoolAndAddress({
    vaultAddress,
    mintAddresses,
    weights,
    swapFee,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
  }: {
    vaultAddress: PublicKey;
    mintAddresses: PublicKey[];
    weights: (number | string)[];
    swapFee: number | string;
    poolKP?: Keypair;
    poolMintKP?: Keypair;
  }): Promise<{ tx: VersionedTransaction; address: PublicKey }> {
    const ixs = await this.ctxWeighted.initializeInstructions(
      vaultAddress,
      poolKP.publicKey,
      poolMintKP.publicKey,
      mintAddresses,
      weights.map((weight) => Math.trunc(Number(weight) * 1e4)),
      Math.trunc(Number(swapFee) * 1e4),
    );

    const tx = await this.ctxWeighted.newTX(ixs);
    tx.sign([poolKP, poolMintKP]);
    return { tx, address: poolKP.publicKey };
  }

  async createStablePoolAndAddress({
    vaultAddress,
    mintAddresses,
    amp,
    swapFee,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
  }: {
    vaultAddress: PublicKey;
    mintAddresses: PublicKey[];
    amp: number | string;
    swapFee: number | string;
    poolKP?: Keypair;
    poolMintKP?: Keypair;
  }): Promise<{ tx: VersionedTransaction; address: PublicKey }> {
    const ixs = await this.ctxStable.initializeInstructions(
      vaultAddress,
      poolKP.publicKey,
      poolMintKP.publicKey,
      mintAddresses,
      Math.trunc(Number(amp)),
      Math.trunc(Number(swapFee) * 1e4),
    );

    const tx = await this.ctxStable.newTX(ixs);
    tx.sign([poolKP, poolMintKP]);
    return { tx, address: poolKP.publicKey };
  }

  async createVaultAndAddress({
    beneficiaryAddress,
    beneficiaryFee,
    poolKind,
    vaultKP = Keypair.generate(),
  }: {
    beneficiaryAddress: PublicKey;
    beneficiaryFee: number | string;
    poolKind: PoolKind;
    vaultKP?: Keypair;
  }): Promise<{ tx: VersionedTransaction; address: PublicKey }> {
    let withdrawAuthorityAddress: PublicKey;
    let withdrawAuthorityBump: number;
    if (poolKind === "weighted") {
      [withdrawAuthorityAddress, withdrawAuthorityBump] = this.ctxWeighted.findWithdrawAuthorityAddressAndBump(
        vaultKP.publicKey,
      );
    } else if (poolKind === "stable") {
      [withdrawAuthorityAddress, withdrawAuthorityBump] = this.ctxStable.findWithdrawAuthorityAddressAndBump(
        vaultKP.publicKey,
      );
    } else {
      throw Error("Unknown pool kind");
    }

    const ixs = await this.ctxVault.initializeInstructions(
      vaultKP.publicKey,
      withdrawAuthorityAddress,
      withdrawAuthorityBump,
      beneficiaryAddress,
      Math.trunc(Number(beneficiaryFee) * 1e4),
    );

    const tx = await this.ctxVault.newTX(ixs);
    tx.sign([vaultKP]);
    return { tx, address: vaultKP.publicKey };
  }

  async deposit({ pool, amount }: { pool: SlrPool; amount: number | string }): Promise<VersionedTransaction> {
    const ixs = await this.ctxSlr.depositInstructions(
      pool.address,
      pool.mintAddress,
      pool.underlyingMintAddress,
      TokenAmountUtil.toBigAmount(amount, pool.data.decimals),
    );
    return this.ctxSlr.newTX(ixs);
  }

  async withdraw({ pool, amount }: { pool: SlrPool; amount: number | string }): Promise<VersionedTransaction> {
    const ixs = await this.ctxSlr.withdrawInstructions(
      pool.address,
      pool.mintAddress,
      pool.underlyingMintAddress,
      TokenAmountUtil.toBigAmount(amount, pool.data.decimals),
    );
    return this.ctxSlr.newTX(ixs);
  }

  async createSlrPoolAndAddress({
    underlyingMintAddress,
    maxLiquidity,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
    name = "",
    symbol = "",
    uri = "",
  }: {
    underlyingMintAddress: PublicKey;
    maxLiquidity: number | string;
    poolKP?: Keypair;
    poolMintKP?: Keypair;
    name?: string;
    symbol?: string;
    uri?: string;
  }): Promise<{ tx: VersionedTransaction; address: PublicKey }> {
    const metadataAddress = Metaplex.make(this.ctxSlr.provider.connection)
      .nfts()
      .pdas()
      .metadata({ mint: poolMintKP.publicKey });
    const underlyingMint = await getMint(this.ctxSlr.provider.connection, underlyingMintAddress);

    const ixs = [
      SystemProgram.createAccount({
        fromPubkey: this.ctxSlr.walletAddress,
        newAccountPubkey: poolMintKP.publicKey,
        space: MintLayout.span,
        lamports: await this.ctxSlr.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        poolMintKP.publicKey,
        underlyingMint.decimals,
        this.ctxSlr.walletAddress,
        this.ctxSlr.walletAddress,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: poolMintKP.publicKey,
          mintAuthority: this.ctxSlr.walletAddress,
          payer: this.ctxSlr.walletAddress,
          updateAuthority: this.ctxSlr.walletAddress,
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
      ...(await this.ctxSlr.initializeInstructions(
        poolKP.publicKey,
        poolMintKP.publicKey,
        underlyingMintAddress,
        TokenAmountUtil.toBigAmount(maxLiquidity, underlyingMint.decimals),
      )),
    ];

    const tx = await this.ctxSlr.newTX(ixs);
    tx.sign([poolKP, poolMintKP]);
    return { tx, address: poolKP.publicKey };
  }
}
