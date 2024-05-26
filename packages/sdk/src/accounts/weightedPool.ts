import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeAmount } from "@stabbleorg/anchor-contrib";
import { Pool, PoolData, PoolToken, PoolTokenData } from "./basePool";
import { Vault } from "./vault";
import { WEIGHTED_SWAP_ID } from "../programs";
import { BasicMath, WeightedMath } from "../utils";

export type WeightedPoolTokenData = PoolTokenData & {
  weight: BN; // u64
};

export type WeightedPoolData = PoolData & {
  invariant: BN;
  tokens: WeightedPoolTokenData[];
};

export class WeightedPool implements Pool<WeightedPoolData> {
  static POOL_TOKEN_DECIMALS = 9;
  static POOL_TOKEN_SIZE = 32 + 1 + 1 + 8 + 8 + 8 + 8;

  static MIN_WEIGHT = 0.1;
  static MAX_WEIGHT = 0.9;

  static MIN_SWAP_FEE = 0.001;
  static MAX_SWAP_FEE = 0.025;

  static MAX_TOKENS = 4;

  data: WeightedPoolData;

  constructor(
    readonly vault: Vault,
    readonly address: PublicKey,
    data: WeightedPoolData,
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
    return WeightedPool.getAuthorityAddress(this.address);
  }

  get invariant(): number {
    return SafeAmount.toUiAmount(this.data.invariant, WeightedPool.POOL_TOKEN_DECIMALS);
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

  get weights(): number[] {
    return this.data.tokens.map((data) => SafeAmount.toNano(data.weight));
  }

  refreshData(updatedData: Partial<WeightedPoolData>) {
    if (updatedData.tokens !== undefined) {
      const tokens = this.data.tokens.map((token, index) => ({
        ...token,
        balance: updatedData.tokens![index].balance,
      }));
      delete updatedData.tokens;
      this.data = { ...this.data, ...updatedData, tokens };
    } else {
      this.data = { ...this.data, ...updatedData };
    }
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

    const balanceOut = WeightedMath.calcOutGivenIn(
      balances[tokenInIndex],
      this.weights[tokenInIndex],
      balances[tokenOutIndex],
      this.weights[tokenOutIndex],
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

      const balanceOut = WeightedMath.calcTokenOutGivenExactPoolTokenIn(
        balances[tokenIndex],
        this.weights[tokenIndex],
        amountIn,
        totalSupply,
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
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), poolAddress.toBuffer()],
      WEIGHTED_SWAP_ID,
    )[0];
  }

  static getWithdrawAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return WeightedPool.getWithdrawAuthorityAddressAndBump(vaultAddress)[0];
  }

  static getWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("withdraw_authority"), vaultAddress.toBuffer()],
      WEIGHTED_SWAP_ID,
    );
  }
}
