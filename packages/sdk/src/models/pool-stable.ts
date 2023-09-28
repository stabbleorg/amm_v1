import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { Vault } from "./vault";
import { TokenAmountUtil } from "../utils";

export type StablePoolTokenData = {
  mint: PublicKey;
  decimals: number;
  multiplier: number;
  scalingFactor: number;
  balance: BN;
};

export type StablePoolData = {
  owner: PublicKey;
  vault: PublicKey;
  mint: PublicKey;
  invariant: BN;
  swapFee: number;
  amp: number;
  ampStart: number;
  ampStartTime: BN;
  ampEndTime: BN;
  ampDuration: number;
  isActive: boolean;
  authorityBump: number;
  tokens: StablePoolTokenData[];
};

export type StablePoolToken = {
  mintAddress: PublicKey;
  decimals: number;
  balance: string;
};

export class StablePool {
  static DECIMALS = 9;

  constructor(
    readonly address: PublicKey,
    readonly data: StablePoolData,
  ) {}

  get tokens(): StablePoolToken[] {
    return this.data.tokens.map((token) => ({
      mintAddress: token.mint,
      decimals: token.decimals,
      balance: TokenAmountUtil.toUiAmount(token.balance, StablePool.DECIMALS),
    }));
  }

  get ownerAddress(): PublicKey {
    return this.data.owner;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get amplification(): number {
    return this.data.amp;
  }

  get swapFee(): number {
    return this.data.swapFee / 1e4;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }
}
