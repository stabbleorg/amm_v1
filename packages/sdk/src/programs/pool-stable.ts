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
import { AccountMeta, PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { type PoolStable as IDLType, IDL } from "../generated/pool_stable";
import { WalletContext } from "../wallet";
import { StablePool } from "../models";
import { TokenAmountUtil } from "../utils";

export type StablePoolProgram = Program<IDLType>;

export class StablePoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: StablePoolProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f"),
      provider,
    );
  }

  findPoolAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Stable Pool Authority"), poolAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  findWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Withdraw Authority"), vaultAddress.toBuffer()],
      this.program.programId,
    );
  }

  async loadPool(poolAddress: PublicKey): Promise<StablePool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new StablePool(poolAddress, data);
  }

  async loadPools(poolAddresses: PublicKey[]): Promise<StablePool[]> {
    return (await this.program.account.pool.fetchMultiple(poolAddresses)).map(
      (data, index) => new StablePool(poolAddresses[index], data!),
    );
  }

  async loadPoolsByVault(vaultAddress: PublicKey): Promise<StablePool[]> {
    const accounts = await this.program.account.pool.all([
      {
        memcmp: {
          offset: 40, // 8+32
          bytes: vaultAddress.toBase58(),
        },
      },
    ]);
    return accounts.map((account) => new StablePool(account.publicKey, account.account));
  }

  async depositInstructions(
    vaultAddress: PublicKey,
    vaultAuthorityAddress: PublicKey,
    poolAddress: PublicKey,
    poolMintAddress: PublicKey,
    amounts: string[],
    decimals: number[],
    mintAddresses: PublicKey[],
  ): Promise<TransactionInstruction[]> {
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
        .deposit(
          amounts.map((amount, index) => TokenAmountUtil.toBigAmount(amount, decimals[index])),
          new BN(0),
        )
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

  async initializeInstructions(
    vaultAddress: PublicKey,
    poolAddress: PublicKey,
    poolMintAddress: PublicKey,
    swapFee: string,
    amp: number,
    mintAddresses: PublicKey[],
  ): Promise<TransactionInstruction[]> {
    const poolAccountSize = this.program.account.pool.size + StablePool.POOL_TOKEN_SIZE * mintAddresses.length + 4;
    const poolAuthorityAddress = this.findPoolAuthorityAddress(poolAddress);
    const metadataAddress = Metaplex.make(this.provider.connection).nfts().pdas().metadata({ mint: poolMintAddress });

    return [
      SystemProgram.createAccount({
        fromPubkey: this.walletAddress,
        newAccountPubkey: poolMintAddress,
        space: MintLayout.span,
        lamports: await this.provider.connection.getMinimumBalanceForRentExemption(MintLayout.span),
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(poolMintAddress, StablePool.DECIMALS, this.walletAddress, this.walletAddress),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: poolMintAddress,
          mintAuthority: this.walletAddress,
          payer: this.walletAddress,
          updateAuthority: this.walletAddress,
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
        .initialize(amp, TokenAmountUtil.toBigAmount(swapFee, 4).toNumber())
        .accounts({
          owner: this.walletAddress,
          mint: poolMintAddress,
          pool: poolAddress,
          poolAuthority: poolAuthorityAddress,
          withdrawAuthority: this.findWithdrawAuthorityAddressAndBump(vaultAddress)[0],
          vault: vaultAddress,
        })
        .remainingAccounts(mintAddresses.map((pubkey) => ({ isSigner: false, isWritable: false, pubkey })))
        .instruction(),
    ];
  }
}
