import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "@stabbleorg/solana-sdk";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function pause(program: Command) {
  program
    .command("pool-weighted-pause")
    .description("pause weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { sdk } = useContext();

      const tx = await sdk.ctxWeighted.newTX(await sdk.ctxWeighted.pauseInstructions(poolK));

      submitTX(tx);
    });
}

export function changeSwapFee(program: Command) {
  program
    .command("pool-weighted-swap-fee")
    .description("change swap fee given a weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--new-swap-fee <string>", "new swap fee")
    .action(async ({ poolK, newSwapFee }: { poolK: PublicKey; newSwapFee: string }) => {
      const { sdk } = useContext();

      const tx = await sdk.ctxWeighted.newTX(
        await sdk.ctxWeighted.changeSwapFeeInstructions(poolK, SafeNumber.toBps(newSwapFee)),
      );

      submitTX(tx);
    });
}
