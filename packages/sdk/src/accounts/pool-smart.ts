import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "../utils";

export type SmartPoolData = {
  vault: PublicKey;
  mint: PublicKey;
  quoteMint: PublicKey;
  decimals: number;
  liquidity: BN;
  maxLiquidity: BN;
  isActive: boolean;
  authorityBump: number;
};

export class SmartPool {
  constructor(
    readonly address: PublicKey,
    readonly data: SmartPoolData,
  ) {}

  get vaultAddress(): PublicKey {
    return this.data.vault;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get quoteMintAddress(): PublicKey {
    return this.data.quoteMint;
  }

  get liquidity(): number {
    return SafeNumber.toUiAmount(this.data.liquidity, this.data.decimals);
  }

  get maxLiquidity(): number {
    return SafeNumber.toUiAmount(this.data.maxLiquidity, this.data.decimals);
  }
}
