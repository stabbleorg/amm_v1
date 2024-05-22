import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Pool, PoolData, PoolToken, PoolTokenData } from "./basePool";
import { Vault } from "./vault";
import { BasicMath, StableMath } from "../utils";

export const STABLE_SWAP_ID: PublicKey = new PublicKey("swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ");

export type StablePoolTokenData = PoolTokenData;

export type StablePoolData = PoolData & {
  ampInitialFactor: number; // u16
  ampTargetFactor: number; // u16
  rampStartTs: BN; // i64
  rampStopTs: BN; // i64
  tokens: StablePoolTokenData[];
};

export class StablePool implements Pool<StablePoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 1 + 8 + 8 + 8;

  static MIN_AMP = 1;
  static MAX_AMP = 5000;

  static MIN_SWAP_FEE = 0.000001;
  static MAX_SWAP_FEE = 0.01;

  static MAX_TOKENS = 5;

  data: StablePoolData;

  constructor(
    readonly vault: Vault,
    readonly address: PublicKey,
    data: StablePoolData,
  ) {
    if (!vault.address.equals(data.vault)) throw Error("Vault address does not match");
    this.data = data;
  }

  get vaultAddress(): PublicKey {
    return this.data.vault;
  }

  get ownerAddress(): PublicKey {
    return this.data.owner;
  }

  get mintAddress(): PublicKey {
    return this.data.mint;
  }

  get authorityAddress(): PublicKey {
    return StablePool.getAuthorityAddress(this.address);
  }

  get amplification(): number {
    const currentTs = new Date().getTime() / 1000;

    if (currentTs <= this.data.rampStartTs.toNumber()) return this.data.ampInitialFactor;
    if (currentTs >= this.data.rampStopTs.toNumber()) return this.data.ampTargetFactor;

    const rampElapsed = currentTs - this.data.rampStartTs.toNumber();
    const rampDuration = this.data.rampStopTs.toNumber() - this.data.rampStartTs.toNumber();
    if (this.data.ampInitialFactor <= this.data.ampTargetFactor) {
      const ampOffset = ((this.data.ampTargetFactor - this.data.ampInitialFactor) * rampElapsed) / rampDuration;
      return this.data.ampInitialFactor + ampOffset;
    } else {
      const ampOffset = ((this.data.ampInitialFactor - this.data.ampTargetFactor) * rampElapsed) / rampDuration;
      return this.data.ampInitialFactor - ampOffset;
    }
  }

  get swapFee(): number {
    return SafeAmount.toNano(this.data.swapFee);
  }

  get isActive(): boolean {
    return this.data.isActive;
  }

  get tokens(): PoolToken[] {
    return this.data.tokens.map((token) => {
      const balance = token.scalingUp ? token.balance.div(token.scalingFactor) : token.balance.mul(token.scalingFactor);
      return {
        mintAddress: token.mint,
        balance: {
          amount: balance.toString(),
          decimals: token.decimals,
          uiAmount: SafeAmount.toUiAmount(balance, token.decimals),
          uiAmountString: SafeAmount.toUiAmountString(balance, token.decimals),
        },
      };
    });
  }

  get balances(): number[] {
    return this.tokens.map((token) => token.balance.uiAmount!);
  }

  refreshData(updatedData: Partial<StablePoolData>) {
    this.data = { ...this.data, ...updatedData };
  }

  getSwapAmountOut(tokenInAddress: PublicKey, tokenOutAddress: PublicKey, amountIn: number): number {
    const tokenInIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenInAddress));
    if (tokenInIndex === -1) return 0;
    const tokenOutIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenOutAddress));
    if (tokenOutIndex === -1) return 0;

    const balances = this.data.tokens.map((token) => SafeAmount.toNano(token.balance));

    const tokenIn = this.data.tokens[tokenInIndex];
    const u64AmountIn = SafeAmount.toU64Amount(amountIn, tokenIn.decimals);
    const balanceIn = SafeAmount.toNano(
      tokenIn.scalingUp ? u64AmountIn.mul(tokenIn.scalingFactor) : u64AmountIn.div(tokenIn.scalingFactor),
    );

    const balanceOut = StableMath.calcOutGivenIn(
      balances,
      this.amplification,
      tokenInIndex,
      tokenOutIndex,
      balanceIn,
      this.swapFee,
    );

    const tokenOut = this.data.tokens[tokenOutIndex];
    const u64BalanceOut = SafeAmount.toGiga(balanceOut);
    const amountOut = SafeAmount.toUiAmount(
      tokenOut.scalingUp ? u64BalanceOut.div(tokenOut.scalingFactor) : u64BalanceOut.mul(tokenOut.scalingFactor),
      tokenOut.decimals,
    );

    return Math.max(amountOut, 0);
  }

  getWithdrawalAmountsOut(amountIn: number, totalSupply: number, tokenAddress?: PublicKey): number[] {
    if (tokenAddress) {
      const tokenIndex = this.tokens.findIndex((token) => token.mintAddress.equals(tokenAddress));

      if (tokenIndex === -1) return [0];

      const balances = this.data.tokens.map((token) => SafeAmount.toNano(token.balance));
      const currentInvariant = StableMath.calcInvariant(balances, this.amplification);

      const balanceOut = StableMath.calcTokenOutGivenExactPoolTokenIn(
        balances,
        this.amplification,
        tokenIndex,
        amountIn,
        totalSupply,
        currentInvariant,
        this.swapFee,
      );

      const tokenOut = this.data.tokens[tokenIndex];
      const u64BalanceOut = SafeAmount.toGiga(balanceOut);
      const amountOut = SafeAmount.toUiAmount(
        tokenOut.scalingUp ? u64BalanceOut.div(tokenOut.scalingFactor) : u64BalanceOut.mul(tokenOut.scalingFactor),
        tokenOut.decimals,
      );

      return [amountOut];
    }

    return BasicMath.calcProportionalAmountsOut(this.balances, amountIn, totalSupply);
  }

  static getAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("pool_authority"), poolAddress.toBuffer()], STABLE_SWAP_ID)[0];
  }

  static getWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return StablePool.getWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  static getWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdraw_authority"), vaultAddress.toBuffer()],
      STABLE_SWAP_ID,
    );
  }
}
