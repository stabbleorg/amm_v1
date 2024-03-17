import { Provider } from "@coral-xyz/anchor";
import {
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  BlockhashWithExpiryBlockHeight,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export type TransactionWithRecentBlock = {
  tx: VersionedTransaction;
  recentBlock?: BlockhashWithExpiryBlockHeight;
};

export class WalletContext<T extends Provider = Provider> {
  constructor(readonly provider: T) {}

  get walletAddress(): PublicKey {
    if (!this.provider.publicKey) throw Error("Please connect your wallet");
    return this.provider.publicKey;
  }

  getAssociatedTokenAddress(mintAddress: PublicKey, owner: PublicKey = this.walletAddress): PublicKey {
    return getAssociatedTokenAddressSync(mintAddress, owner, true);
  }

  async getOrCreateAssociatedTokenAddressInstruction(
    mintAddress: PublicKey,
    owner: PublicKey = this.walletAddress,
  ): Promise<{ address: PublicKey; instruction?: TransactionInstruction }> {
    const address = getAssociatedTokenAddressSync(mintAddress, owner, true);
    let instruction;

    try {
      await getAccount(this.provider.connection, address);
    } catch (err) {
      if (err instanceof TokenAccountNotFoundError) {
        instruction = createAssociatedTokenAccountInstruction(this.walletAddress, address, owner, mintAddress);
      } else {
        throw err;
      }
    }

    return { address, instruction };
  }

  newTX(
    instructions: TransactionInstruction[],
    altAccounts: AddressLookupTableAccount[] = [],
    payerAddress?: PublicKey,
  ): Promise<TransactionWithRecentBlock> {
    return this.newPrioritizedTX(instructions, 0, altAccounts, payerAddress);
  }

  async newPrioritizedTX(
    instructions: TransactionInstruction[],
    priorityFee: number = 0,
    altAccounts: AddressLookupTableAccount[] = [],
    payerAddress?: PublicKey,
  ): Promise<TransactionWithRecentBlock> {
    const recentBlock = await this.provider.connection.getLatestBlockhash();

    if (priorityFee) {
      instructions.unshift(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFee,
        }),
      );
    }

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payerAddress || this.walletAddress,
        recentBlockhash: recentBlock.blockhash,
        instructions,
      }).compileToV0Message(altAccounts),
    );

    return { tx, recentBlock };
  }

  async newLegacyTX(
    instructions: TransactionInstruction[],
    payerAddress?: PublicKey,
  ): Promise<TransactionWithRecentBlock> {
    const recentBlock = await this.provider.connection.getLatestBlockhash();

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payerAddress || this.walletAddress,
        recentBlockhash: recentBlock.blockhash,
        instructions,
      }).compileToLegacyMessage(),
    );

    return { tx, recentBlock };
  }
}
