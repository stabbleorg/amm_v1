import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "../utils";

export type SlrPoolData = {
  authorityBump: number;
  decimals: number;
  mint: PublicKey;
  supply: BN;
  underlyingMint: PublicKey;
  liquidity: BN;
  reservedLiquidity: BN;
  lockedLiquidity: BN;
  maxLiquidity: BN;
};

export class SlrPool {
  constructor(
    readonly address: PublicKey,
    readonly data: SlrPoolData,
  ) {}

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get supply(): number {
    return SafeNumber.toUiAmount(this.data.supply, this.data.decimals);
  }

  get underlyingMintAddress(): PublicKey {
    return this.data.underlyingMint;
  }

  get liquidity(): number {
    return SafeNumber.toUiAmount(this.data.liquidity, this.data.decimals);
  }

  get reservedLiquidity(): number {
    return SafeNumber.toUiAmount(this.data.reservedLiquidity, this.data.decimals);
  }

  get lockedLiquidity(): number {
    return SafeNumber.toUiAmount(this.data.lockedLiquidity, this.data.decimals);
  }

  get maxLiquidity(): number {
    return SafeNumber.toUiAmount(this.data.maxLiquidity, this.data.decimals);
  }
}
