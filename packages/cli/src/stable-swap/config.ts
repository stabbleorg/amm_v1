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
        const { provider, simulate } = useContext();

        const stableSwap = new StableSwapContext(provider);
        const pool = await stableSwap.loadPool(poolK);

        console.log("Current amplification:", pool.amplification);

        if (simulate) return;

        const signature = await stableSwap.changeAmpFactor({
          pool,
          ampFactor,
          rampDuration,
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
      const { provider, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current swap fee:", pool.swapFee);

      if (simulate) return;

      const signature = await stableSwap.changeSwapFee({
        pool,
        swapFee,
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
      const { provider, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current owner:", pool.ownerAddress.toBase58());

      if (simulate) return;

      const signature = await stableSwap.transferOwner({
        pool,
        ownerAddress: ownerK,
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
      const { provider, simulate } = useContext();

      const stableSwap = new StableSwapContext(provider);
      const pool = await stableSwap.loadPool(poolK);

      console.log("Current owner:", pool.ownerAddress.toBase58());
      console.log("Pending owner:", pool.data.pendingOwner?.toBase58());

      if (simulate) return;

      const signature = await stableSwap.acceptOwner({
        pool,
      });

      console.log(signature);
    });
}
