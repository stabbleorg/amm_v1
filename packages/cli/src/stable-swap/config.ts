import type { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { StableSwapContext } from "@stabbleorg/amm-sdk";
import { useContext } from "../context";
import { parseKey } from "../utils";

export function changeAmpFactor(program: Command) {
  program
    .command("stable-amp-factor")
    .description("change amplification factor")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--amp-factor <number>", "new amplification factor", Number)
    .requiredOption("--ramp-duration <number>", "ramp duration", Number)
    .action(
      async ({ poolK, ampFactor, rampDuration }: { poolK: PublicKey; ampFactor: number; rampDuration: number }) => {
        const { provider, priorityLevel, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        console.log("Current amplification:", pool.amplification);

        const signature = await stableSwap.changeAmpFactor({
          pool,
          ampFactor,
          rampDuration,
          priorityLevel,
          simulate,
        });

        console.log(signature);
      },
    );
}

export function changeSwapFee(program: Command) {
  program
    .command("stable-swap-fee")
    .description("change swap fee")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--swap-fee <string>", "new swap fee")
    .action(async ({ poolK, swapFee }: { poolK: PublicKey; swapFee: string }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current swap fee:", pool.swapFee);

      const signature = await stableSwap.changeSwapFee({
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
    .command("stable-max-supply")
    .description("change max supply of LP token")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--max-supply <string>", "new max supply")
    .action(async ({ poolK, maxSupply }: { poolK: PublicKey; maxSupply: string }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current max supply:", pool.maxSupply);

      const signature = await stableSwap.changeMaxSupply({
        pool,
        maxSupply,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}

export function transferOwner(program: Command) {
  program
    .command("stable-transfer-owner")
    .description("transfer ownership")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .requiredOption("--owner-k <string>", "new owner key", parseKey)
    .action(async ({ poolK, ownerK }: { poolK: PublicKey; ownerK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current owner:", pool.ownerAddress.toBase58());

      const signature = await stableSwap.transferOwner({
        pool,
        ownerAddress: ownerK,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}

export function acceptOwner(program: Command) {
  program
    .command("stable-accept-owner")
    .description("accept ownership")
    .requiredOption("--pool-k <string>", "pool key", parseKey)
    .action(async ({ poolK }: { poolK: PublicKey }) => {
      const { provider, priorityLevel, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current owner:", pool.ownerAddress.toBase58());
      console.log("Pending owner:", pool.data.pendingOwner?.toBase58());

      const signature = await stableSwap.acceptOwner({
        pool,
        priorityLevel,
        simulate,
      });

      console.log(signature);
    });
}
