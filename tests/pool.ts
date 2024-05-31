import { assert } from "chai";
import { BN } from "bn.js";
import { AnchorProvider, Provider } from "@coral-xyz/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  Vault,
  Pool,
  WeightedPool,
  StablePool,
  WeightedPoolData,
  StablePoolData,
  WeightedMath,
  VaultContext,
  WeightedSwapContext,
  StableSwapContext,
  WeightedSwapListener,
  StableSwapListener,
} from "@stabbleorg/amm-sdk";
import { ChangedBalance, InitializedPool, SwapParser } from "@stabbleorg/amm-parser";
import {
  WEIGHTED_VAULT_KP,
  STABLE_VAULT_KP,
  USDC_MINT_KP,
  USDT_MINT_KP,
  DAI_MINT_KP,
  MSOL_MINT_KP,
  STB_MINT_KP,
  BONK_MINT_KP,
} from "./consts";

describe("Pool", () => {
  const env = AnchorProvider.env();

  const connection = new Connection(env.connection.rpcEndpoint, "confirmed");
  const provider = new AnchorProvider(connection, env.wallet, {
    commitment: "confirmed",
    maxRetries: 1,
    preflightCommitment: "confirmed",
    skipPreflight: true,
  });

  const guestProvider: Provider = { connection };

  const vaultCtx = new VaultContext(provider);
  const weightedSwap = new WeightedSwapContext(provider);
  const stableSwap = new StableSwapContext(provider);

  const guestVaultCtx = new VaultContext(guestProvider);
  const guestWeightedSwap = new WeightedSwapContext(guestProvider);
  const guestStableSwap = new StableSwapContext(guestProvider);

  const weightedSwapListener = new WeightedSwapListener(guestWeightedSwap.program);
  const stableSwapListener = new StableSwapListener(guestStableSwap.program);

  const parser = new SwapParser(guestWeightedSwap.program);

  const pools: Pool<WeightedPoolData | StablePoolData>[] = [];

  let weightedVault: Vault;
  let stableVault: Vault;

  let POOL_ID_STB_USDC: PublicKey;
  let POOL_ID_BONK_SOL_USDC: PublicKey;
  let POOL_ID_USDT_USDC: PublicKey;
  let POOL_ID_MSOL_SOL: PublicKey;
  let POOL_ID_DAI_USDC: PublicKey;

  before(async () => {
    const vaults = await guestVaultCtx.findAll();
    weightedVault = vaults.find((vault) => vault.address.equals(WEIGHTED_VAULT_KP.publicKey))!;
    stableVault = vaults.find((vault) => vault.address.equals(STABLE_VAULT_KP.publicKey))!;

    weightedSwapListener.addPoolListener((event) => {
      const updatedPool = pools.find((pool) => event.pubkey.equals(pool.address));
      if (updatedPool) updatedPool.refreshData(event.data);
    });
    stableSwapListener.addPoolListener((event) => {
      const updatedPool = pools.find((pool) => event.pubkey.equals(pool.address));
      if (updatedPool) updatedPool.refreshData(event.data);
    });
  });

  after(() => {
    weightedSwapListener.removePoolListener();
    stableSwapListener.removePoolListener();
  });

  describe("STB50-USDC50", () => {
    it("should create weighted pool", async () => {
      const mintAddresses = [STB_MINT_KP.publicKey, USDC_MINT_KP.publicKey];

      const { pool, signature } = await weightedSwap.initialize({
        vault: weightedVault,
        mintAddresses,
        maxCaps: [500000000, 4000000000],
        weights: [0.5, "0.5"], // 50:50
        swapFee: "0.005", // 0.5%
      });
      pools.push(pool);
      POOL_ID_STB_USDC = pool.address;

      const parsedResults = await parser.parse(signature);
      const parsedResult = parsedResults[0] as InitializedPool;
      assert.equal(parsedResult.address, pool.address.toBase58());
      assert.equal(parsedResult.mintAddress, pool.mintAddress.toBase58());

      // STB: $0.03, USDC: $1
      const bRatio_STB_USDC = WeightedMath.calcBalanceRatio(0.5, 0.03, 0.5, 1);
      const usdcAmount = 1000000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;

      await vaultCtx.createMissingTokenAccounts({ vault: weightedVault, mintAddresses });

      // add initial liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [stbAmount, usdcAmount],
      });
    });

    it("should make balanced deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))! as WeightedPool;

      const mintAddresses = pool.tokens.map((token) => token.mintAddress);
      const bRatio_STB_USDC = pool.tokens[0].balance.uiAmount! / pool.tokens[1].balance.uiAmount!;
      const usdcAmount = 10000;
      const stbAmount = usdcAmount * bRatio_STB_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      const signature = await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [stbAmount, usdcAmount],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      const ratio = balance.uiAmount! / amountOut;
      assert.ok(ratio > 100);
      assert.ok(ratio < 100.00004);

      const parsedResults = await parser.parse(signature);
      const parsedResult = parsedResults[0] as ChangedBalance;
      assert.equal(parsedResult.poolAddress, pool.address.toBase58());
      assert.equal(parsedResult.userAddress, weightedSwap.walletAddress.toBase58());
      assert.equal(parsedResult.amounts[0].mintAddress, STB_MINT_KP.publicKey.toBase58());
      assert.equal(parsedResult.amounts[1].mintAddress, USDC_MINT_KP.publicKey.toBase58());
      assert.equal(parsedResult.amounts[2].mintAddress, pool.mintAddress.toBase58());
      assert.equal(
        (-parsedResult.amounts[2].amount).toString(),
        new BN(postBalance.amount).sub(new BN(balance.amount)).toString(),
      );

      const { value: stbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );
      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      await weightedSwap.withdraw({
        pool,
        mintAddresses,
        amount: amountOut,
      });

      const { value: postStbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );
      const stbAmountOut = postStbBalance.uiAmount! - stbBalance.uiAmount!;
      const stbRatio = stbAmount / stbAmountOut;
      assert.ok(stbRatio > 1);
      assert.ok(stbRatio < 1.000001);

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcAmountOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      const usdcRatio = usdcAmount / usdcAmountOut;
      assert.ok(usdcRatio > 1);
      assert.ok(usdcRatio < 1.000001);
    });

    it("should swap STB for USDC", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))! as WeightedPool;

      const amountIn = 10000;
      const slippage = 0.003; // 0.03%
      const estimatedAmountOut = pool.getSwapAmountOut(STB_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn);
      // 1 STB/USDC = estimatedAmountOut / amountIn
      // 1 USDC/STB = amountIn / estimatedAmountOut
      const minimumAmountOut = estimatedAmountOut * (1 - slippage);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      const signature = await weightedSwap.swap({
        pool,
        mintInAddress: STB_MINT_KP.publicKey,
        mintOutAddress: USDC_MINT_KP.publicKey,
        amountIn: amountIn,
        minimumAmountOut,
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      // assert.ok(amountOut <= estimatedAmountOut * 1.0001);
      assert.ok(amountOut >= minimumAmountOut);

      const parsedResults = await parser.parse(signature);
      const parsedResult = parsedResults[0] as ChangedBalance;
      assert.equal(parsedResult.poolAddress, pool.address.toBase58());
      assert.equal(parsedResult.userAddress, weightedSwap.walletAddress.toBase58());
      assert.equal(parsedResult.amounts[0].mintAddress, STB_MINT_KP.publicKey.toBase58());
      assert.equal(parsedResult.amounts[1].mintAddress, USDC_MINT_KP.publicKey.toBase58());
      assert.equal(parsedResult.beneficiaryAddress, pool.vault.beneficiaryAddress.toBase58());
      assert.equal(
        (-parsedResult.amounts[1].amount).toString(),
        new BN(postBalance.amount).sub(new BN(balance.amount)).toString(),
      );
    });

    it("should make imbalanced deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))! as WeightedPool;

      const mintAddresses = pool.tokens.map((token) => token.mintAddress);
      const bRatio_STB_USDC = pool.tokens[0].balance.uiAmount! / pool.tokens[1].balance.uiAmount!;
      const stbAmount = 1000;
      const usdcAmount = stbAmount * bRatio_STB_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [stbAmount, usdcAmount],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const amountOut = postBalance.uiAmount! - balance.uiAmount!;

      const { value: stbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );
      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      const signature = await weightedSwap.withdraw({
        pool,
        mintAddresses,
        amount: amountOut,
      });

      const { value: postStbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );
      const stbAmountOut = postStbBalance.uiAmount! - stbBalance.uiAmount!;
      assert.ok(stbAmount < stbAmountOut);

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcAmountOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      assert.ok(usdcAmount > usdcAmountOut);

      const parsedResults = await parser.parse(signature);
      const parsedResult = parsedResults[0] as ChangedBalance;
      assert.equal(parsedResult.poolAddress, pool.address.toBase58());
      assert.equal(parsedResult.userAddress, weightedSwap.walletAddress.toBase58());
      assert.equal(parsedResult.amounts[0].mintAddress, pool.tokens[0].mintAddress.toBase58());
      assert.equal(parsedResult.amounts[1].mintAddress, pool.tokens[1].mintAddress.toBase58());
      assert.equal(
        (-parsedResult.amounts[0].amount).toString(),
        new BN(postStbBalance.amount).sub(new BN(stbBalance.amount)).toString(),
      );
      assert.equal(
        (-parsedResult.amounts[1].amount).toString(),
        new BN(postUsdcBalance.amount).sub(new BN(usdcBalance.amount)).toString(),
      );
    });

    it("should make single deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))! as WeightedPool;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amounts: [1000],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;

      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      await weightedSwap.withdraw({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amount: amountOut,
      });

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      assert.ok(usdcOut > 994);

      const { value: balance2 } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses: [STB_MINT_KP.publicKey],
        amounts: [33333.333333333],
      });

      const { value: postBalance2 } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(pool.mintAddress),
      );
      const amountOut2 = postBalance2.uiAmount! - balance2.uiAmount!;

      const { value: stbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );

      // remove liquidity
      await weightedSwap.withdraw({
        pool,
        mintAddresses: [STB_MINT_KP.publicKey],
        amount: amountOut2,
      });

      const { value: postStbBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(STB_MINT_KP.publicKey),
      );
      const stbOut = postStbBalance.uiAmount! - stbBalance.uiAmount!;
      assert.ok(stbOut > 33133);
      assert.ok(stbOut < 33333.333333333);
    });

    it("should have more balance in vault than in pool", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_STB_USDC))! as WeightedPool;

      const { value: vaultStbBalance } = await provider.connection.getTokenAccountBalance(
        weightedVault.getAuthorityTokenAddress(pool.tokens[0].mintAddress),
      );
      assert.equal(vaultStbBalance.amount, pool.tokens[0].balance.amount);

      const { value: vaultUsdcBalance } = await provider.connection.getTokenAccountBalance(
        weightedVault.getAuthorityTokenAddress(pool.tokens[1].mintAddress),
      );
      assert.equal(vaultUsdcBalance.amount, pool.tokens[1].balance.amount);
    });
  });

  describe("Bonk50-SOL30-USDC20", () => {
    it("should create/deposit/withdraw", async () => {
      const mintAddresses = [BONK_MINT_KP.publicKey, NATIVE_MINT, USDC_MINT_KP.publicKey];

      const { pool } = await weightedSwap.initialize({
        vault: weightedVault,
        mintAddresses,
        maxCaps: ["10000000000000", 4000000000, 4000000000],
        weights: [0.5, 0.3, "0.2"], // 50:30:20
        swapFee: "0.005", // 0.5%
      });
      pools.push(pool);
      POOL_ID_BONK_SOL_USDC = pool.address;

      // Bonk: $0.000001, SOL: $148, USDC: $1
      const bRatio_Bonk_USDC = WeightedMath.calcBalanceRatio(0.5, 0.000001, 0.2, 1);
      const bRatio_SOL_USDC = WeightedMath.calcBalanceRatio(0.3, 148, 0.2, 1);
      const usdcAmount = 500000;
      const bonkAmount = usdcAmount * bRatio_Bonk_USDC;
      const solAmount = usdcAmount * bRatio_SOL_USDC;

      await vaultCtx.createMissingTokenAccounts({ vault: weightedVault, mintAddresses });

      // add initial liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [bonkAmount, solAmount, usdcAmount],
      });

      // add liquidity
      await weightedSwap.deposit({
        pool,
        mintAddresses,
        amounts: [bonkAmount, solAmount, usdcAmount],
      });
      await weightedSwap.deposit({
        pool,
        mintAddresses: [BONK_MINT_KP.publicKey],
        amounts: [bonkAmount / 5],
      });
      await weightedSwap.deposit({
        pool,
        mintAddresses: [NATIVE_MINT],
        amounts: [solAmount / 5],
      });
      await weightedSwap.deposit({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amounts: [usdcAmount / 5],
      });

      // remove liquidity
      await weightedSwap.withdraw({
        pool,
        mintAddresses: [BONK_MINT_KP.publicKey],
        amount: 10000,
      });
      await weightedSwap.withdraw({
        pool,
        mintAddresses: [NATIVE_MINT],
        amount: 10000,
      });
      await weightedSwap.withdraw({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amount: 10000,
      });
      await weightedSwap.withdraw({
        pool,
        mintAddresses,
        amount: 30000,
      });
    });

    it("should swap SOL for USDC", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_BONK_SOL_USDC))! as WeightedPool;

      const amountIn = 10;
      const slippage = 0.003; // 0.03%
      const estimatedAmountOut = pool.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, amountIn);
      // 1 SOL/USDC = estimatedAmountOut / amountIn
      // 1 USDC/SOL = amountIn / estimatedAmountOut
      const minimumAmountOut = estimatedAmountOut * (1 - slippage);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      await weightedSwap.swap({
        pool,
        mintInAddress: NATIVE_MINT,
        mintOutAddress: USDC_MINT_KP.publicKey,
        amountIn: amountIn,
        minimumAmountOut,
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      // assert.ok(amountOut <= estimatedAmountOut * 1.0001);
      assert.ok(amountOut >= minimumAmountOut);
    });

    it("should have more balance in vault than in pool", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_BONK_SOL_USDC))! as WeightedPool;

      const { value: vaultBonkBalance } = await provider.connection.getTokenAccountBalance(
        weightedVault.getAuthorityTokenAddress(pool.tokens[0].mintAddress),
      );
      assert.equal(vaultBonkBalance.amount, pool.tokens[0].balance.amount);

      const { value: vaultSolBalance } = await provider.connection.getTokenAccountBalance(
        weightedVault.getAuthorityTokenAddress(pool.tokens[1].mintAddress),
      );
      assert.equal(vaultSolBalance.amount, pool.tokens[1].balance.amount);
    });
  });

  describe("USDT-USDC", () => {
    it("should create stable pool", async () => {
      const mintAddresses = [USDT_MINT_KP.publicKey, USDC_MINT_KP.publicKey];
      const ampFactor = 5000;

      const { pool } = await stableSwap.initialize({
        vault: stableVault,
        mintAddresses,
        maxCaps: [3000000000, 3000000000],
        ampFactor,
        swapFee: "0.0001", // 0.01%
      });
      pools.push(pool);
      POOL_ID_USDT_USDC = pool.address;

      await vaultCtx.createMissingTokenAccounts({ vault: stableVault, mintAddresses });

      // add initial liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: ["3165522.820842", "771061.758046"],
      });
    });

    it("should make balanced deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_USDT_USDC))! as StablePool;

      const mintAddresses = pool.tokens.map((token) => token.mintAddress);
      const bRatio_USDT_USDC = pool.tokens[0].balance.uiAmount! / pool.tokens[1].balance.uiAmount!;
      const usdcAmount = 7710.61758;
      const usdtAmount = usdcAmount * bRatio_USDT_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: [usdtAmount, usdcAmount],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      const ratio = balance.uiAmount! / amountOut;
      assert.ok(ratio > 99.99998);
      assert.ok(ratio < 100.00002);

      const { value: usdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );
      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      await stableSwap.withdraw({
        pool,
        mintAddresses,
        amount: amountOut,
      });

      const { value: postUsdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );
      const usdtAmountOut = postUsdtBalance.uiAmount! - usdtBalance.uiAmount!;
      const usdtRatio = usdtAmount / usdtAmountOut;
      assert.ok(usdtRatio > 1);
      assert.ok(usdtRatio < 1.000001);

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcAmountOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      const usdcRatio = usdcAmount / usdcAmountOut;
      assert.ok(usdcRatio > 1);
      assert.ok(usdcRatio < 1.000001);
    });

    it("should swap USDT for USDC", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_USDT_USDC))! as StablePool;

      const amountIn = 10;
      const slippage = 0.001; // 0.01%
      const estimatedAmountOut = pool.getSwapAmountOut(USDT_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn);
      // 1 USDT/USDC = estimatedAmountOut / amountIn
      // 1 USDC/USDT = amountIn / estimatedAmountOut
      const minimumAmountOut = estimatedAmountOut * (1 - slippage);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      await stableSwap.swap({
        pool,
        mintInAddress: USDT_MINT_KP.publicKey,
        mintOutAddress: USDC_MINT_KP.publicKey,
        amountIn: amountIn,
        minimumAmountOut,
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      // assert.ok(amountOut <= estimatedAmountOut * 1.0001);
      assert.ok(amountOut >= minimumAmountOut);
    });

    it("should make imbalanced deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_USDT_USDC))! as StablePool;

      const mintAddresses = pool.tokens.map((token) => token.mintAddress);
      const bRatio_USDT_USDC = pool.tokens[0].balance.uiAmount! / pool.tokens[1].balance.uiAmount!;
      const usdtAmount = 7710.61758;
      const usdcAmount = usdtAmount * bRatio_USDT_USDC;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: [usdtAmount, usdcAmount],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      const amountOut = postBalance.uiAmount! - balance.uiAmount!;

      const { value: usdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );
      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      await stableSwap.withdraw({
        pool,
        mintAddresses,
        amount: amountOut,
      });

      const { value: postUsdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );
      const usdtAmountOut = postUsdtBalance.uiAmount! - usdtBalance.uiAmount!;
      assert.ok(usdtAmount < usdtAmountOut);

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcAmountOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      assert.ok(usdcAmount > usdcAmountOut);
    });

    it("should make single deposit", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_USDT_USDC))! as StablePool;

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amounts: [1000],
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;

      const { value: usdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      // remove liquidity
      await stableSwap.withdraw({
        pool,
        mintAddresses: [USDC_MINT_KP.publicKey],
        amount: amountOut,
      });

      const { value: postUsdcBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const usdcOut = postUsdcBalance.uiAmount! - usdcBalance.uiAmount!;
      assert.ok(usdcOut > 999.8);
      assert.ok(usdcOut < 1000);

      const { value: balance2 } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );

      // add liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses: [USDT_MINT_KP.publicKey],
        amounts: [1000],
      });

      const { value: postBalance2 } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(pool.mintAddress),
      );
      const amountOut2 = postBalance2.uiAmount! - balance2.uiAmount!;

      const { value: usdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );

      // remove liquidity
      await stableSwap.withdraw({
        pool,
        mintAddresses: [USDT_MINT_KP.publicKey],
        amount: amountOut2,
      });

      const { value: postUsdtBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
      );
      const usdtOut = postUsdtBalance.uiAmount! - usdtBalance.uiAmount!;
      assert.ok(usdtOut > 999.9);
      assert.ok(usdtOut < 1000);
    });

    it("should have more balance in vault than in pool", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_USDT_USDC))! as StablePool;

      const { value: vaultUsdcBalance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(pool.tokens[0].mintAddress),
      );
      assert.equal(vaultUsdcBalance.amount, pool.tokens[0].balance.amount);

      const { value: vaultUsdtBalance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(pool.tokens[1].mintAddress),
      );
      assert.equal(vaultUsdtBalance.amount, pool.tokens[1].balance.amount);
    });
  });

  describe("MSOL-SOL", () => {
    it("should create/deposit/withdraw", async () => {
      const mintAddresses = [MSOL_MINT_KP.publicKey, NATIVE_MINT];
      const ampFactor = 50;

      const { pool } = await stableSwap.initialize({
        vault: stableVault,
        mintAddresses,
        maxCaps: [3000000000, 3000000000],
        ampFactor,
        swapFee: "0.0001", // 0.01%
      });
      pools.push(pool);
      POOL_ID_MSOL_SOL = pool.address;

      await vaultCtx.createMissingTokenAccounts({ vault: stableVault, mintAddresses });

      // add initial liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: [6915.978, 54972.969],
      });

      // add liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: [69.15978, 549.72969],
      });
      await stableSwap.deposit({
        pool,
        mintAddresses: [MSOL_MINT_KP.publicKey],
        amounts: [69.15978],
      });
      await stableSwap.deposit({
        pool,
        mintAddresses: [NATIVE_MINT],
        amounts: [549.72969],
      });

      // remove liquidity
      await stableSwap.withdraw({
        pool,
        mintAddresses: [MSOL_MINT_KP.publicKey],
        amount: 600,
      });
      await stableSwap.withdraw({
        pool,
        mintAddresses: [NATIVE_MINT],
        amount: 600,
      });
      await stableSwap.withdraw({
        pool,
        mintAddresses,
        amount: 1200,
      });
    });

    it("should swap MSOL for SOL", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_MSOL_SOL))! as StablePool;

      const amountIn = 10;
      const slippage = 0.003; // 0.03%
      const estimatedAmountOut = pool.getSwapAmountOut(MSOL_MINT_KP.publicKey, NATIVE_MINT, amountIn);
      // 1 MSOL/SOL = estimatedAmountOut / amountIn
      // 1 SOL/MSOL = amountIn / estimatedAmountOut
      const minimumAmountOut = estimatedAmountOut * (1 - slippage);

      const balance = await provider.connection.getBalance(stableSwap.walletAddress);

      await stableSwap.swap({
        pool,
        mintInAddress: MSOL_MINT_KP.publicKey,
        mintOutAddress: NATIVE_MINT,
        amountIn: amountIn,
        minimumAmountOut,
      });

      const postBalance = await provider.connection.getBalance(stableSwap.walletAddress);
      const amountOut = (postBalance - balance) / LAMPORTS_PER_SOL;
      // assert.ok(amountOut <= estimatedAmountOut * 1.0001);
      assert.ok(amountOut >= minimumAmountOut);
    });

    it("should have more balance in vault than in pool", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_MSOL_SOL))! as StablePool;

      const { value: vaultMsolBalance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(pool.tokens[0].mintAddress),
      );
      assert.equal(vaultMsolBalance.amount, pool.tokens[0].balance.amount);

      const { value: vaultSolBalance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(pool.tokens[1].mintAddress),
      );
      assert.equal(vaultSolBalance.amount, pool.tokens[1].balance.amount);
    });
  });

  describe("DAI-USDC", () => {
    it("should create stable pool", async () => {
      const mintAddresses = [DAI_MINT_KP.publicKey, USDC_MINT_KP.publicKey];
      const ampFactor = 750;

      const { pool } = await stableSwap.initialize({
        vault: stableVault,
        mintAddresses,
        maxCaps: [3000000000, 3000000000],
        ampFactor,
        swapFee: "0.0004", // 0.04%
      });
      pools.push(pool);
      POOL_ID_DAI_USDC = pool.address;

      await vaultCtx.createMissingTokenAccounts({ vault: stableVault, mintAddresses });

      // add initial liquidity
      await stableSwap.deposit({
        pool,
        mintAddresses,
        amounts: [87485.12, 93921],
      });
    });

    it("should swap DAI for USDC", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_DAI_USDC))! as StablePool;

      const amountIn = 7.133;
      const slippage = 0.001; // 0.01%
      const estimatedAmountOut = pool.getSwapAmountOut(DAI_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn);
      // 1 DAI/USDC = estimatedAmountOut / amountIn
      // 1 USDC/DAI = amountIn / estimatedAmountOut
      const minimumAmountOut = estimatedAmountOut * (1 - slippage);

      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );

      await stableSwap.swap({
        pool,
        mintInAddress: DAI_MINT_KP.publicKey,
        mintOutAddress: USDC_MINT_KP.publicKey,
        amountIn: amountIn,
        minimumAmountOut,
      });

      const { value: postBalance } = await provider.connection.getTokenAccountBalance(
        stableSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
      );
      const amountOut = postBalance.uiAmount! - balance.uiAmount!;
      // assert.ok(amountOut <= estimatedAmountOut * 1.0001);
      assert.ok(amountOut >= minimumAmountOut);
    });

    it("should have more balance in vault than in pool", async () => {
      const pool = pools.find((pool) => pool.address.equals(POOL_ID_DAI_USDC))! as StablePool;

      const { value: vaultDaiBalance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(pool.tokens[0].mintAddress),
      );
      assert.equal(vaultDaiBalance.amount, pool.tokens[0].balance.amount);
    });
  });
});
