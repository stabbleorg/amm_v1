import {
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  BlockhashWithExpiryBlockHeight,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Provider } from "./provider";

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
  ): Promise<{ address: PublicKey; instruction: TransactionInstruction | null }> {
    const address = getAssociatedTokenAddressSync(mintAddress, owner, true);
    let instruction = null;

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

  async newTX(
    instructions: TransactionInstruction[],
    altAccounts: AddressLookupTableAccount[] = [],
    payerAddress?: PublicKey,
  ): Promise<TransactionWithRecentBlock> {
    const recentBlock = await this.provider.connection.getLatestBlockhash();

    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: payerAddress || this.walletAddress,
        recentBlockhash: recentBlock.blockhash,
        instructions,
      }).compileToV0Message(altAccounts),
    );

    return { tx, recentBlock };
  }
}
