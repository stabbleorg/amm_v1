import { BN, Provider } from "@coral-xyz/anchor";
import { Metaplex } from "@metaplex-foundation/js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import {
  AuthorityType,
  MintLayout,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createSetAuthorityInstruction,
  getMint,
} from "@solana/spl-token";
import { PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { TransactionWithRecentBlock } from "@stabbleorg/anchor-contrib";
import { VaultContext, StablePoolContext, WeightedPoolContext } from "./programs";
import { AmmPool, StablePool, WeightedPool, Vault } from "./accounts";
import { SafeNumber } from "./utils";

export type PoolKind = "weighted" | "stable";

export interface AmmContexts<T extends Provider> {
  vault: VaultContext<T>;
  stable: StablePoolContext<T>;
  weighted: WeightedPoolContext<T>;
}

export class Amm<T extends Provider> {
  constructor(
    readonly contexts: AmmContexts<T>,
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

  async swap({
    pool,
    mintInAddress,
    mintOutAddress,
    amountIn,
    minimumAmountOut = 0,
  }: {
    pool: AmmPool;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    amountIn: number | string;
    minimumAmountOut?: number | string;
  }): Promise<TransactionWithRecentBlock> {
    const vault = this.vaults.find((v) => v.address.equals(pool.vaultAddress));
    if (!vault) throw Error("Unknown swap");
    const tokenIn = pool.tokens.find((token) => token.mintAddress.equals(mintInAddress));
    if (!tokenIn) throw Error("Invalid token input");
    const tokenOut = pool.tokens.find((token) => token.mintAddress.equals(mintOutAddress));
    if (!tokenOut) throw Error("Invalid token output");

    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.swapInstructions({
          beneficiaryAddress: vault.beneficiaryAddress,
          vaultAddress: vault.address,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(vault.address),
          vaultProgramAddress: this.ctxVault.program.programId,
          poolAddress: pool.address,
          mintInAddress,
          mintOutAddress,
          amountIn: SafeNumber.toBigAmount(amountIn, tokenIn.decimals),
          minimumAmountOut: SafeNumber.toBigAmount(minimumAmountOut, tokenOut.decimals),
        })),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.swapInstructions({
          beneficiaryAddress: vault.beneficiaryAddress,
          vaultAddress: vault.address,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(vault.address),
          vaultProgramAddress: this.ctxVault.program.programId,
          poolAddress: pool.address,
          mintInAddress,
          mintOutAddress,
          amountIn: SafeNumber.toBigAmount(amountIn, tokenIn.decimals),
          minimumAmountOut: SafeNumber.toBigAmount(minimumAmountOut, tokenOut.decimals),
        })),
      );
    } else {
      throw Error("Unknown swap");
    }

    return this.ctxVault.newTX(ixs);
  }

  async deposit({
    pool,
    mintAddresses,
    amounts,
  }: {
    pool: AmmPool;
    mintAddresses: PublicKey[];
    amounts: (string | number)[];
  }): Promise<TransactionWithRecentBlock> {
    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.depositInstructions({
          vaultAddress: pool.vaultAddress,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          poolAddress: pool.address,
          poolMintAddress: pool.mintAddress,
          mintAddresses,
          amounts: amounts.map((amount, index) =>
            SafeNumber.toBigAmount(
              amount,
              pool.tokens.find((token) => token.mintAddress.equals(mintAddresses[index]))!.decimals,
            ),
          ),
          minimumAmountOut: new BN(0),
        })),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.depositInstructions({
          vaultAddress: pool.vaultAddress,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          poolAddress: pool.address,
          poolMintAddress: pool.mintAddress,
          mintAddresses,
          amounts: amounts.map((amount, index) =>
            SafeNumber.toBigAmount(
              amount,
              pool.tokens.find((token) => token.mintAddress.equals(mintAddresses[index]))!.decimals,
            ),
          ),
          minimumAmountOut: new BN(0),
        })),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async withdraw({
    pool,
    mintAddresses,
    amount,
  }: {
    pool: AmmPool;
    mintAddresses: PublicKey[];
    amount: string | number;
  }): Promise<TransactionWithRecentBlock> {
    const ixs: TransactionInstruction[] = [];

    if (pool instanceof WeightedPool) {
      ixs.push(
        ...(await this.ctxWeighted.withdrawInstructions({
          vaultAddress: pool.vaultAddress,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          vaultProgramAddress: this.ctxVault.program.programId,
          poolAddress: pool.address,
          poolMintAddress: pool.mintAddress,
          mintAddresses,
          amount: SafeNumber.toBigAmount(amount, WeightedPool.POOL_TOKEN_DECIMALS),
          minimumAmountsOut: [],
        })),
      );
    } else if (pool instanceof StablePool) {
      ixs.push(
        ...(await this.ctxStable.withdrawInstructions({
          vaultAddress: pool.vaultAddress,
          vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
          vaultProgramAddress: this.ctxVault.program.programId,
          poolAddress: pool.address,
          poolMintAddress: pool.mintAddress,
          mintAddresses,
          amount: SafeNumber.toBigAmount(amount, StablePool.POOL_TOKEN_DECIMALS),
          minimumAmountsOut: [],
        })),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async createWeightedPoolAndAddress({
    vaultAddress,
    mintAddresses,
    swapFee,
    weights,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
    name = "",
    symbol = "",
    uri = "",
  }: {
    vaultAddress: PublicKey;
    mintAddresses: PublicKey[];
    swapFee: number | string;
    weights: (number | string)[];
    poolKP?: Keypair;
    poolMintKP?: Keypair;
    name?: string;
    symbol?: string;
    uri?: string;
  }): Promise<TransactionWithRecentBlock & { address: PublicKey }> {
    const mints = await Promise.all(
      mintAddresses.map((address) => getMint(this.ctxWeighted.provider.connection, address)),
    );
    const metadataAddress = Metaplex.make(this.ctxWeighted.provider.connection)
      .nfts()
      .pdas()
      .metadata({ mint: poolMintKP.publicKey });

    const ixs = [
      SystemProgram.createAccount({
        fromPubkey: this.ctxWeighted.walletAddress,
        newAccountPubkey: poolMintKP.publicKey,
        space: MintLayout.span,
        lamports: await this.ctxWeighted.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        poolMintKP.publicKey,
        StablePool.POOL_TOKEN_DECIMALS,
        // this.ctxWeighted.findPoolAuthorityAddress(poolKP.publicKey),
        // null,
        this.ctxWeighted.walletAddress,
        this.ctxWeighted.walletAddress,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: poolMintKP.publicKey,
          mintAuthority: this.ctxWeighted.walletAddress,
          payer: this.ctxWeighted.walletAddress,
          updateAuthority: this.ctxWeighted.walletAddress,
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
        this.ctxWeighted.walletAddress,
        AuthorityType.MintTokens,
        this.ctxWeighted.findPoolAuthorityAddress(poolKP.publicKey),
      ),
      createSetAuthorityInstruction(
        poolMintKP.publicKey,
        this.ctxWeighted.walletAddress,
        AuthorityType.FreezeAccount,
        null,
      ),
      ...(await this.ctxWeighted.initializeInstructions({
        vaultAddress,
        poolAddress: poolKP.publicKey,
        poolMintAddress: poolMintKP.publicKey,
        mintAddresses,
        swapFee: SafeNumber.toBasisPoints(swapFee),
        weights: weights.map((weight) => SafeNumber.toBigAmount(weight, 9)),
      })),
    ];

    const txRes = await this.ctxWeighted.newTX(ixs);
    txRes.tx.sign([poolKP, poolMintKP]);

    return { ...txRes, address: poolKP.publicKey };
  }

  async createStablePoolAndAddress({
    vaultAddress,
    mintAddresses,
    amp,
    swapFee,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
    name = "",
    symbol = "",
    uri = "",
  }: {
    vaultAddress: PublicKey;
    mintAddresses: PublicKey[];
    amp: number | string;
    swapFee: number | string;
    poolKP?: Keypair;
    poolMintKP?: Keypair;
    name?: string;
    symbol?: string;
    uri?: string;
  }): Promise<TransactionWithRecentBlock & { address: PublicKey }> {
    const metadataAddress = Metaplex.make(this.ctxStable.provider.connection)
      .nfts()
      .pdas()
      .metadata({ mint: poolMintKP.publicKey });

    const ixs = [
      SystemProgram.createAccount({
        fromPubkey: this.ctxStable.walletAddress,
        newAccountPubkey: poolMintKP.publicKey,
        space: MintLayout.span,
        lamports: await this.ctxStable.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        poolMintKP.publicKey,
        StablePool.POOL_TOKEN_DECIMALS,
        // this.ctxStable.findPoolAuthorityAddress(poolKP.publicKey),
        // null,
        this.ctxStable.walletAddress,
        this.ctxStable.walletAddress,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: poolMintKP.publicKey,
          mintAuthority: this.ctxStable.walletAddress,
          payer: this.ctxStable.walletAddress,
          updateAuthority: this.ctxStable.walletAddress,
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
        this.ctxStable.walletAddress,
        AuthorityType.MintTokens,
        this.ctxStable.findPoolAuthorityAddress(poolKP.publicKey),
      ),
      createSetAuthorityInstruction(
        poolMintKP.publicKey,
        this.ctxStable.walletAddress,
        AuthorityType.FreezeAccount,
        null,
      ),
      ...(await this.ctxStable.initializeInstructions({
        vaultAddress,
        poolAddress: poolKP.publicKey,
        poolMintAddress: poolMintKP.publicKey,
        mintAddresses,
        amp: Math.floor(Number(amp)),
        swapFee: SafeNumber.toBasisPoints(swapFee),
      })),
    ];

    const txRes = await this.ctxStable.newTX(ixs);
    txRes.tx.sign([poolKP, poolMintKP]);

    return { ...txRes, address: poolKP.publicKey };
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
  }): Promise<TransactionWithRecentBlock & { address: PublicKey }> {
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

    const ixs = await this.ctxVault.initializeInstructions({
      vaultAddress: vaultKP.publicKey,
      withdrawAuthorityAddress,
      withdrawAuthorityBump,
      beneficiaryAddress,
      beneficiaryFee: SafeNumber.toBasisPoints(beneficiaryFee),
    });

    const txRes = await this.ctxVault.newTX(ixs);
    txRes.tx.sign([vaultKP]);

    return { ...txRes, address: vaultKP.publicKey };
  }
}
