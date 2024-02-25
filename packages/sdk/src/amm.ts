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
import { PublicKey, Keypair, TransactionInstruction, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { VaultContext, StablePoolContext, WeightedPoolContext } from "./programs";
import {
  BasePool,
  StablePool,
  StablePoolData,
  StablePoolToken,
  WeightedPool,
  WeightedPoolData,
  WeightedPoolToken,
  Vault,
} from "./accounts";
import { PoolKind } from "./consts";
import { SafeNumber } from "./utils";

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
    pool: BasePool<WeightedPoolToken | StablePoolToken, WeightedPoolData | StablePoolData>;
    mintInAddress: PublicKey;
    mintOutAddress: PublicKey;
    amountIn: number | string;
    minimumAmountOut?: number | string;
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
          SafeNumber.toBigAmount(amountIn, tokenIn.decimals),
          SafeNumber.toBigAmount(minimumAmountOut, tokenOut.decimals),
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
          SafeNumber.toBigAmount(amountIn, tokenIn.decimals),
          SafeNumber.toBigAmount(minimumAmountOut, tokenOut.decimals),
        )),
      );
    } else {
      throw Error("Unknown pool");
    }

    return this.ctxVault.newTX(ixs);
  }

  async deposit({
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
            SafeNumber.toBigAmount(
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
            SafeNumber.toBigAmount(
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

  async withdraw({
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
          SafeNumber.toBigAmount(amount, WeightedPool.POOL_TOKEN_DECIMALS),
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
          SafeNumber.toBigAmount(amount, StablePool.POOL_TOKEN_DECIMALS),
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
    swapFee,
    weights,
    ticks,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
  }: {
    vaultAddress: PublicKey;
    mintAddresses: PublicKey[];
    swapFee: number | string;
    weights: (number | string)[];
    ticks?: (number | string)[];
    poolKP?: Keypair;
    poolMintKP?: Keypair;
  }): Promise<{ tx: VersionedTransaction; address: PublicKey }> {
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
              name: "",
              symbol: "",
              uri: "",
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
      ...(await this.ctxWeighted.initializeInstructions(
        vaultAddress,
        poolKP.publicKey,
        poolMintKP.publicKey,
        mintAddresses,
        SafeNumber.toBps(swapFee),
        weights.map((weight) => SafeNumber.toBps(weight)),
        ticks
          ? ticks.map((tickSize, index) => SafeNumber.toBigAmount(tickSize, mints[index].decimals))
          : Array(mintAddresses.length).fill(new BN(1)),
      )),
    ];

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
              name: "",
              symbol: "",
              uri: "",
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
      ...(await this.ctxStable.initializeInstructions(
        vaultAddress,
        poolKP.publicKey,
        poolMintKP.publicKey,
        mintAddresses,
        Math.floor(Number(amp)),
        SafeNumber.toBps(swapFee),
      )),
    ];

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
      SafeNumber.toBps(beneficiaryFee),
    );

    const tx = await this.ctxVault.newTX(ixs);
    tx.sign([vaultKP]);
    return { tx, address: vaultKP.publicKey };
  }
}
