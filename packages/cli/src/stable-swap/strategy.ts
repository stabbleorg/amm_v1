import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function createStrategy(program: Command) {
  program
    .command("stable-strategy-create")
    .description("create strategy for stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amp-min-factor <number>", "minimum amplification factor", Number)
    .requiredOption("--amp-max-factor <number>", "maximum amplification factor", Number)
    .requiredOption("--ramp-min-step <number>", "minimum ramping step", Number)
    .requiredOption("--ramp-max-step <number>", "maximum ramping step", Number)
    .requiredOption("--ramp-min-duration <number>", "minimum ramping duration", Number)
    .requiredOption("--ramp-max-duration <number>", "maximum ramping duration", Number)
    .action(
      async ({
        poolK,
        ampMinFactor,
        ampMaxFactor,
        rampMinStep,
        rampMaxStep,
        rampMinDuration,
        rampMaxDuration,
      }: {
        poolK: PublicKey;
        ampMinFactor: number;
        ampMaxFactor: number;
        rampMinStep: number;
        rampMaxStep: number;
        rampMinDuration: number;
        rampMaxDuration: number;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        const { address, signature } = await stableSwap.createStrategy({
          pool,
          ampMinFactor,
          ampMaxFactor,
          rampMinStep,
          rampMaxStep,
          rampMinDuration,
          rampMaxDuration,
          priorityLevel,
          simulate,
        });

        console.log("Strategy:", address.toBase58());
        console.log(signature);
      },
    );
}

export function execStrategy(program: Command) {
  program
    .command("stable-strategy-exec")
    .description("execute strategy for stable pool")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--strategy-k <string>", "strategy key", parseKey)
    .requiredOption("--ramp-step <number>", "minimum ramping step", Number)
    .requiredOption("--ramp-duration <number>", "minimum ramping duration", Number)
    .action(
      async ({
        poolK,
        strategyK,
        rampStep,
        rampDuration,
      }: {
        poolK: PublicKey;
        strategyK: PublicKey;
        rampStep: number;
        rampDuration: number;
      }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        const signature = await stableSwap.execStrategy({
          pool,
          address: strategyK,
          rampStep,
          rampDuration,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}
