import { Provider } from "@coral-xyz/anchor";
import {
  TokenAccountNotFoundError,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  PublicKey,
  SignatureResult,
  TransactionInstruction,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";

export class WalletContext<T extends Provider> {
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

  async newLegacyTX(instructions: TransactionInstruction[], payerAddress?: PublicKey): Promise<VersionedTransaction> {
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    return new VersionedTransaction(
      new TransactionMessage({
        payerKey: payerAddress || this.walletAddress,
        recentBlockhash: blockhash,
        instructions,
      }).compileToLegacyMessage(),
    );
  }

  async newTX(
    instructions: TransactionInstruction[],
    lut: AddressLookupTableAccount[] = [],
    payerAddress?: PublicKey,
  ): Promise<VersionedTransaction> {
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    return new VersionedTransaction(
      new TransactionMessage({
        payerKey: payerAddress || this.walletAddress,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(lut),
    );
  }

  async confirmTX(signature: TransactionSignature): Promise<SignatureResult> {
    const recentBlock = await this.provider.connection.getLatestBlockhash();
    const { value } = await this.provider.connection.confirmTransaction({
      ...recentBlock,
      signature,
    });
    return value;
  }
}
