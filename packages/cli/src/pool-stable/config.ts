import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "@stabbleorg/solana-sdk";
import { useContext, submitTX } from "../context";
import { parseKey } from "../utils";

export function pause(program: Command) {
  program
    .command("stable-pause")
    .description("pause stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { amm } = useContext();

      const { tx } = await amm.ctxStable.newTX(await amm.ctxStable.pauseInstructions({ poolAddress: poolK }));

      submitTX(tx);
    });
}

export function changeSwapFee(program: Command) {
  program
    .command("stable-swap-fee")
    .description("change swap fee given a stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--new-swap-fee <string>", "new swap fee")
    .action(async ({ poolK, newSwapFee }: { poolK: PublicKey; newSwapFee: string }) => {
      const { amm } = useContext();

      const { tx } = await amm.ctxStable.newTX(
        await amm.ctxStable.changeSwapFeeInstructions({
          poolAddress: poolK,
          newSwapFee: SafeNumber.toBasisPoints(newSwapFee),
        }),
      );

      submitTX(tx);
    });
}
