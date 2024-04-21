import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "@stabbleorg/solana-sdk";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function pause(program: Command) {
  program
    .command("weighted-pause")
    .description("pause weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { amm } = useContext();

      const { transaction } = await amm.ctxWeighted.newTX(await amm.ctxWeighted.pauseInstructions({ poolAddress: poolK }));

      submitTX(transaction);
    });
}

export function changeSwapFee(program: Command) {
  program
    .command("weighted-swap-fee")
    .description("change swap fee given a weighted pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--new-swap-fee <string>", "new swap fee")
    .action(async ({ poolK, newSwapFee }: { poolK: PublicKey; newSwapFee: string }) => {
      const { amm } = useContext();

      const { transaction } = await amm.ctxWeighted.newTX(
        await amm.ctxWeighted.changeSwapFeeInstructions({
          poolAddress: poolK,
          newSwapFee: SafeNumber.toBasisPoints(newSwapFee),
        }),
      );

      submitTX(transaction);
    });
}
