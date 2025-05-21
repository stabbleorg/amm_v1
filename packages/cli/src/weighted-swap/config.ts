import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { WeightedSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function changeSwapFee(program: Command) {
  program
    .command("weighted-swap-fee")
    .description("change swap fee")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--swap-fee <string>", "new swap fee")
    .action(async ({ poolK, swapFee }: { poolK: PublicKey; swapFee: string }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      console.log("Current swap fee:", pool.swapFee);

      const signature = await weightedSwap.changeSwapFee({
        pool,
        swapFee,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}

export function changeMaxSupply(program: Command) {
  program
    .command("weighted-max-supply")
    .description("change max supply of LP token")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--max-supply <string>", "new max supply")
    .action(async ({ poolK, maxSupply }: { poolK: PublicKey; maxSupply: string }) => {
      const { provider, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      console.log("Current max supply:", pool.maxSupply);

      if (simulate) return;

      const signature = await weightedSwap.changeMaxSupply({
        pool,
        maxSupply,
      });

      console.log(signature);
    });
}

export function pause(program: Command) {
  program
    .command("weighted-pause")
    .description("pause")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      const signature = await weightedSwap.pause({
        pool,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}

export function unpause(program: Command) {
  program
    .command("weighted-unpause")
    .description("unpause")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      const signature = await weightedSwap.unpause({
        pool,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}

export function transferOwner(program: Command) {
  program
    .command("weighted-transfer-owner")
    .description("transfer ownership")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--owner-k <string>", "new owner key")
    .action(async ({ poolK, ownerK }: { poolK: PublicKey; ownerK: PublicKey }) => {
      const { provider, simulate } = useContext();

      const weightedSwap = new WeightedSwapContext(provider);
      const pool = await weightedSwap.loadPool(poolK);

      console.log("Current owner:", pool.ownerAddress.toBase58());

      if (simulate) return;

      const signature = await weightedSwap.transferOwner({
        pool,
        ownerAddress: ownerK,
      });

      console.log(signature);
    });
}
