import type { Command } from "commander";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount, WalletContext } from "@stabbleorg/anchor-contrib";
import { createJupiterApiClient } from "@jup-ag/api";
import { useContext } from "../context";

export function swap(program: Command) {
  program
    .command("token-swap")
    .description("token swap via Jupiter")
    .requiredOption("--mint-in-k <string>", "token in key")
    .requiredOption("--mint-out-k <string>", "token in key")
    .requiredOption("--amount <number>", "trade amount")
    .action(async ({ mintInK, mintOutK, amount }: { mintInK: string; mintOutK: string; amount: string }) => {
      const { provider, simulate } = useContext();

      const mintIn = await getMint(provider.connection, new PublicKey(mintInK));
      const mintOut = await getMint(provider.connection, new PublicKey(mintOutK));

      const walletContext = new WalletContext(provider);

      const api = createJupiterApiClient({ basePath: "https://lite-api.jup.ag" });

      const quoteResponse = await api.quoteGet({
        inputMint: mintInK,
        outputMint: mintOutK,
        amount: SafeAmount.toU64Amount(amount, mintIn.decimals).toNumber(),
        dynamicSlippage: true,
      });

      console.log("Slippage bps:", quoteResponse.slippageBps);
      console.log("Amount out:", SafeAmount.toUiAmount(quoteResponse.outAmount, mintOut.decimals));
      if (simulate) return;

      const { swapTransaction } = await api.swapPost({
        swapRequest: {
          quoteResponse,
          userPublicKey: walletContext.walletAddress.toBase58(),
          dynamicSlippage: true,
          wrapAndUnwrapSol: true,
        },
      });

      const signature = await walletContext.sendTransactionFromBuffer(Buffer.from(swapTransaction, "base64"));

      console.log(signature);
    });
}
