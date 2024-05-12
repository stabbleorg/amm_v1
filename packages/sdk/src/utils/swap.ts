import { Keypair, PublicKey, Signer, TransactionInstruction, TransactionSignature } from "@solana/web3.js";
import { FloatLike, TransactionArgs } from "@stabbleorg/anchor-contrib";
import { Pool, StablePool, StablePoolData, WeightedPool, WeightedPoolData } from "../accounts";
import { StableSwapContext, WeightedSwapContext } from "../programs";
import { NATIVE_MINT } from "@solana/spl-token";

export type BatchSwapRoute = {
  pool: Pool<StablePoolData | WeightedPoolData>;
  mintInAddress: PublicKey;
  mintOutAddress: PublicKey;
};

export type SwapInstructionArgs = {
  pool: Pool<StablePoolData | WeightedPoolData>;
  mintInAddress: PublicKey;
  mintOutAddress: PublicKey;
  tokenInAddress?: PublicKey;
  tokenOutAddress?: PublicKey;
  amountIn?: FloatLike;
  minimumAmountOut?: FloatLike;
};

export class Swap {
  static async batch({
    weightedSwap,
    stableSwap,
    routes,
    amountIn,
    minimumAmountOut,
    priorityLevel,
    altAccounts,
  }: TransactionArgs<{
    weightedSwap: WeightedSwapContext;
    stableSwap: StableSwapContext;
    routes: BatchSwapRoute[];
    amountIn: FloatLike;
    minimumAmountOut: FloatLike;
  }>): Promise<TransactionSignature> {
    // direct swap
    if (routes.length === 1) {
      if (routes[0].pool instanceof StablePool) {
        return stableSwap.swap({
          pool: routes[0].pool,
          mintInAddress: routes[0].mintInAddress,
          mintOutAddress: routes[0].mintOutAddress,
          amountIn,
          minimumAmountOut,
          priorityLevel,
          altAccounts,
        });
      } else if (routes[0].pool instanceof WeightedPool) {
        return weightedSwap.swap({
          pool: routes[0].pool,
          mintInAddress: routes[0].mintInAddress,
          mintOutAddress: routes[0].mintOutAddress,
          amountIn,
          minimumAmountOut,
          priorityLevel,
          altAccounts,
        });
      } else {
        throw Error("Pool not supported");
      }
    }
    // 2-hop swap
    else if (routes.length === 2) {
      const signers: Signer[] = [];
      const instructions: TransactionInstruction[] = [];

      let tokenInAddress: PublicKey | undefined = undefined;
      if (routes[0].mintInAddress === NATIVE_MINT) {
        const keypair = Keypair.generate();
        signers.push(keypair);
        tokenInAddress = keypair.publicKey;
        instructions.push(...(await weightedSwap.transferWSOLInstructions(tokenInAddress, amountIn)));
      }

      let tokenOutAddress: PublicKey | undefined = undefined;
      {
        const keypair = Keypair.generate();
        signers.push(keypair);
        tokenOutAddress = keypair.publicKey;
        instructions.push(
          ...(await weightedSwap.createIntermediateTokenAccountInstructions(tokenOutAddress, routes[0].mintOutAddress)),
        );
      }

      const args0: SwapInstructionArgs = {
        pool: routes[0].pool,
        mintInAddress: routes[0].mintInAddress,
        mintOutAddress: routes[0].mintOutAddress,
        amountIn,
        tokenInAddress,
        tokenOutAddress,
      };
      if (routes[0].pool instanceof WeightedPool) {
        instructions.push(...(await weightedSwap.swapInstructions(args0)));
      } else if (routes[0].pool instanceof StablePool) {
        instructions.push(...(await stableSwap.swapInstructions(args0)));
      } else {
        throw Error("Pool not supported");
      }

      const args1: SwapInstructionArgs = {
        pool: routes[1].pool,
        mintInAddress: routes[1].mintInAddress,
        mintOutAddress: routes[1].mintOutAddress,
        minimumAmountOut,
        tokenInAddress: tokenOutAddress,
      };
      if (routes[1].pool instanceof WeightedPool) {
        instructions.push(...(await weightedSwap.swapInstructions(args1)));
      } else if (routes[1].pool instanceof StablePool) {
        instructions.push(...(await stableSwap.swapInstructions(args1)));
      } else {
        throw Error("Pool not supported");
      }

      const { transaction, recentBlock, slot } = await weightedSwap.createTransaction(
        instructions,
        altAccounts,
        priorityLevel,
      );
      return weightedSwap.sendAndConfirmTransaction(transaction, recentBlock, slot, signers);
    }
    // 3-hop swap
    else {
      throw Error("3-hop swap not supported");
    }
  }
}
