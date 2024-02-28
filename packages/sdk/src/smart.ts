import { Provider } from "@coral-xyz/anchor";
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
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { VaultContext, SmartPoolContext } from "./programs";
import { SmartPool, Vault } from "./accounts";
import { TransactionWithRecentBlock } from "./wallet";
import { SafeNumber } from "./utils";

export interface SmartContexts<T extends Provider> {
  vault: VaultContext<T>;
  smart: SmartPoolContext<T>;
}

export class Smart<T extends Provider> {
  constructor(
    readonly contexts: SmartContexts<T>,
    readonly vaults: Vault[] = [],
  ) {}

  get ctxVault(): VaultContext<T> {
    return this.contexts.vault;
  }

  get ctxSmart(): SmartPoolContext<T> {
    return this.contexts.smart;
  }

  async deposit({ pool, amount }: { pool: SmartPool; amount: number | string }): Promise<TransactionWithRecentBlock> {
    const ixs = await this.ctxSmart.depositInstructions({
      vaultAddress: pool.vaultAddress,
      vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
      poolAddress: pool.address,
      poolMintAddress: pool.mintAddress,
      quoteMintAddress: pool.quoteMintAddress,
      amount: SafeNumber.toBigAmount(amount, pool.data.decimals),
    });

    return this.ctxSmart.newTX(ixs);
  }

  async withdraw({ pool, amount }: { pool: SmartPool; amount: number | string }): Promise<TransactionWithRecentBlock> {
    const ixs = await this.ctxSmart.withdrawInstructions({
      vaultAddress: pool.vaultAddress,
      vaultAuthorityAddress: this.ctxVault.findVaultAuthorityAddress(pool.vaultAddress),
      vaultProgramAddress: this.ctxVault.program.programId,
      poolAddress: pool.address,
      poolMintAddress: pool.mintAddress,
      quoteMintAddress: pool.quoteMintAddress,
      amount: SafeNumber.toBigAmount(amount, pool.data.decimals),
    });

    return this.ctxSmart.newTX(ixs);
  }

  async createSmartPoolAndAddress({
    vaultAddress,
    quoteMintAddress,
    maxLiquidity,
    poolKP = Keypair.generate(),
    poolMintKP = Keypair.generate(),
    name = "",
    symbol = "",
    uri = "",
  }: {
    vaultAddress: PublicKey;
    quoteMintAddress: PublicKey;
    maxLiquidity: number | string;
    poolKP?: Keypair;
    poolMintKP?: Keypair;
    name?: string;
    symbol?: string;
    uri?: string;
  }): Promise<TransactionWithRecentBlock & { address: PublicKey }> {
    const metadataAddress = Metaplex.make(this.ctxSmart.provider.connection)
      .nfts()
      .pdas()
      .metadata({ mint: poolMintKP.publicKey });
    const quoteMint = await getMint(this.ctxSmart.provider.connection, quoteMintAddress);

    const ixs = [
      SystemProgram.createAccount({
        fromPubkey: this.ctxSmart.walletAddress,
        newAccountPubkey: poolMintKP.publicKey,
        space: MintLayout.span,
        lamports: await this.ctxSmart.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        poolMintKP.publicKey,
        quoteMint.decimals,
        this.ctxSmart.walletAddress,
        this.ctxSmart.walletAddress,
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: poolMintKP.publicKey,
          mintAuthority: this.ctxSmart.walletAddress,
          payer: this.ctxSmart.walletAddress,
          updateAuthority: this.ctxSmart.walletAddress,
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
        this.ctxSmart.walletAddress,
        AuthorityType.MintTokens,
        this.ctxSmart.findPoolAuthorityAddress(poolKP.publicKey),
      ),
      createSetAuthorityInstruction(
        poolMintKP.publicKey,
        this.ctxSmart.walletAddress,
        AuthorityType.FreezeAccount,
        null,
      ),
      ...(await this.ctxSmart.initializeInstructions({
        vaultAddress,
        poolAddress: poolKP.publicKey,
        poolMintAddress: poolMintKP.publicKey,
        quoteMintAddress,
        maxLiquidity: SafeNumber.toBigAmount(maxLiquidity, quoteMint.decimals),
      })),
    ];

    const txRes = await this.ctxSmart.newTX(ixs);
    txRes.tx.sign([poolKP, poolMintKP]);

    return { ...txRes, address: poolKP.publicKey };
  }

  async createVaultAndAddress({
    beneficiaryAddress,
    beneficiaryFee,
    vaultKP = Keypair.generate(),
  }: {
    beneficiaryAddress: PublicKey;
    beneficiaryFee: number | string;
    vaultKP?: Keypair;
  }): Promise<TransactionWithRecentBlock & { address: PublicKey }> {
    const [withdrawAuthorityAddress, withdrawAuthorityBump] = this.ctxSmart.findWithdrawAuthorityAddressAndBump(
      vaultKP.publicKey,
    );

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
