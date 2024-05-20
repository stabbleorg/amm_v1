import BN from "bn.js";
import { assert } from "chai";
import { AnchorProvider, Provider } from "@coral-xyz/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  Vault,
  Pool,
  WeightedPool,
  StablePool,
  WeightedPoolData,
  StablePoolData,
  VaultContext,
  WeightedSwapContext,
  StableSwapContext,
  WeightedSwapListener,
  StableSwapListener,
  Swap,
} from "@stabbleorg/amm-sdk";
import {
  WEIGHTED_VAULT_KP,
  STABLE_VAULT_KP,
  USDC_MINT_KP,
  USDT_MINT_KP,
  DAI_MINT_KP,
  MSOL_MINT_KP,
  STB_MINT_KP,
} from "./consts";

describe("Multi-hop Swap", () => {
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

  const pools: Pool<WeightedPoolData | StablePoolData>[] = [];

  let weightedVault: Vault;
  let stableVault: Vault;

  before(async () => {
    const vaults = await guestVaultCtx.findAll();
    weightedVault = vaults.find((vault) => vault.address.equals(WEIGHTED_VAULT_KP.publicKey))!;
    stableVault = vaults.find((vault) => vault.address.equals(STABLE_VAULT_KP.publicKey))!;

    pools.push(...(await guestWeightedSwap.findByVault(weightedVault)));
    pools.push(...(await guestStableSwap.findByVault(stableVault)));

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

  it("DAI-USDC-USDT", async () => {
    const amountIn = 1000;
    const slippage = 0.0001; // slippage 0.01%

    // best DAI-USDC pool
    const pool_DAI_USDC = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(DAI_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn) -
        p1.getSwapAmountOut(DAI_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn),
    )[0];
    const intermediateAmountIn = pool_DAI_USDC.getSwapAmountOut(
      DAI_MINT_KP.publicKey,
      USDC_MINT_KP.publicKey,
      amountIn,
    );
    // console.log("Estimated USDC out:", intermediateAmountIn);

    // best USDC-USDT pool
    const pool_USDC_USDT = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn) -
        p1.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn),
    )[0];

    const amountOut = pool_USDC_USDT.getSwapAmountOut(
      USDC_MINT_KP.publicKey,
      USDT_MINT_KP.publicKey,
      intermediateAmountIn,
    );
    console.log("Estimated USDT out:", amountOut);

    // DAI/USDT = amountOut / amountIn
    // USDT/DAI = amountIn / amountOut

    const minimumAmountOut = amountOut * (1 - slippage);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );

    await Swap.batch({
      weightedSwap,
      stableSwap,
      routes: [
        {
          pool: pool_DAI_USDC,
          mintInAddress: DAI_MINT_KP.publicKey,
          mintOutAddress: USDC_MINT_KP.publicKey,
        },
        {
          pool: pool_USDC_USDT,
          mintInAddress: USDC_MINT_KP.publicKey,
          mintOutAddress: USDT_MINT_KP.publicKey,
        },
      ],
      amountIn,
      minimumAmountOut,
    });

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );
    const usdtAmountOut = postBalance.uiAmount! - balance.uiAmount!;

    console.log("USDT out:", usdtAmountOut);
    // assert.ok(usdtAmountOut <= amountOut * 1.0001);
    assert.ok(usdtAmountOut >= minimumAmountOut);
  });

  it("STB-USDC-USDT", async () => {
    // const amountIn = 1000000;
    const amountIn = 0.033333334;
    const slippage = 0.005; // slippage 0.05%

    // best STB-USDC pool
    const pool_STB_USDC = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(STB_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn) -
        p1.getSwapAmountOut(STB_MINT_KP.publicKey, USDC_MINT_KP.publicKey, amountIn),
    )[0];
    const intermediateAmountIn = pool_STB_USDC.getSwapAmountOut(
      STB_MINT_KP.publicKey,
      USDC_MINT_KP.publicKey,
      amountIn,
    );
    // console.log("Estimated USDC out:", intermediateAmountIn);

    // best USDC-USDT pool
    const pool_USDC_USDT = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn) -
        p1.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn),
    )[0];

    const amountOut = pool_USDC_USDT.getSwapAmountOut(
      USDC_MINT_KP.publicKey,
      USDT_MINT_KP.publicKey,
      intermediateAmountIn,
    );
    console.log("Estimated USDT out:", amountOut);

    // STB/USDT = amountOut / amountIn
    // USDT/STB = amountIn / amountOut

    const minimumAmountOut = amountOut * (1 - slippage);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );

    await Swap.batch({
      weightedSwap,
      stableSwap,
      routes: [
        {
          pool: pool_STB_USDC,
          mintInAddress: STB_MINT_KP.publicKey,
          mintOutAddress: USDC_MINT_KP.publicKey,
        },
        {
          pool: pool_USDC_USDT,
          mintInAddress: USDC_MINT_KP.publicKey,
          mintOutAddress: USDT_MINT_KP.publicKey,
        },
      ],
      amountIn,
      minimumAmountOut,
    });

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );
    const usdtAmountOut = postBalance.uiAmount! - balance.uiAmount!;

    console.log("USDT out:", usdtAmountOut);
    // assert.ok(usdtAmountOut <= amountOut * 1.0001);
    assert.ok(usdtAmountOut >= minimumAmountOut);
  });

  it("MSOL-SOL-USDC", async () => {
    const amountIn = 1;
    const slippage = 0.005; // slippage 0.5%

    // best MSOL-SOL pool
    const pool_MSOL_SOL = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(MSOL_MINT_KP.publicKey, NATIVE_MINT, amountIn) -
        p1.getSwapAmountOut(MSOL_MINT_KP.publicKey, NATIVE_MINT, amountIn),
    )[0];
    const intermediateAmountIn = pool_MSOL_SOL.getSwapAmountOut(MSOL_MINT_KP.publicKey, NATIVE_MINT, amountIn);
    // console.log("Estimated SOL out:", intermediateAmountIn);

    // best SOL-USDC pool
    const pool_SOL_USDC = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, intermediateAmountIn) -
        p1.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, intermediateAmountIn),
    )[0];

    const amountOut = pool_SOL_USDC.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, intermediateAmountIn);
    console.log("Estimated USDC out:", amountOut);

    // MSOL/USDC = amountOut / amountIn
    // USDC/MSOL = amountIn / amountOut

    const minimumAmountOut = amountOut * (1 - slippage);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
    );

    await Swap.batch({
      weightedSwap,
      stableSwap,
      routes: [
        {
          pool: pool_MSOL_SOL,
          mintInAddress: MSOL_MINT_KP.publicKey,
          mintOutAddress: NATIVE_MINT,
        },
        {
          pool: pool_SOL_USDC,
          mintInAddress: NATIVE_MINT,
          mintOutAddress: USDC_MINT_KP.publicKey,
        },
      ],
      amountIn,
      minimumAmountOut,
    });

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDC_MINT_KP.publicKey),
    );
    const usdcAmountOut = postBalance.uiAmount! - balance.uiAmount!;

    console.log("USDC out:", usdcAmountOut);
    // assert.ok(usdcAmountOut <= amountOut * 1.0001);
    assert.ok(usdcAmountOut >= minimumAmountOut);
  });

  it("SOL-USDC-USDT", async () => {
    const amountIn = 10;
    const slippage = 0.0001; // slippage 0.01%

    // best SOL-USDC pool
    const pool_SOL_USDC = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, amountIn) -
        p1.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, amountIn),
    )[0];
    const intermediateAmountIn = pool_SOL_USDC.getSwapAmountOut(NATIVE_MINT, USDC_MINT_KP.publicKey, amountIn);
    // console.log("Estimated USDC out:", intermediateAmountIn);

    // best USDC-USDT pool
    const pool_USDC_USDT = pools.sort(
      (p1, p2) =>
        p2.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn) -
        p1.getSwapAmountOut(USDC_MINT_KP.publicKey, USDT_MINT_KP.publicKey, intermediateAmountIn),
    )[0];

    const amountOut = pool_USDC_USDT.getSwapAmountOut(
      USDC_MINT_KP.publicKey,
      USDT_MINT_KP.publicKey,
      intermediateAmountIn,
    );
    console.log("Estimated USDT out:", amountOut);

    // SOL/USDT = amountOut / amountIn
    // USDT/SOL = amountIn / amountOut

    const minimumAmountOut = amountOut * (1 - slippage);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );

    const keypair0 = Keypair.generate();
    {
      // transfer WSOL first because transaction size is too big without Address Lookup Table
      const { transaction, recentBlock, slot } = await weightedSwap.createTransaction(
        await weightedSwap.transferWSOLInstructions(keypair0.publicKey, amountIn),
      );
      await weightedSwap.sendAndConfirmTransaction(transaction, recentBlock, slot, [keypair0]);
    }

    const keypair = Keypair.generate();
    const instructions: TransactionInstruction[] = [
      // TODO: Address Lookup Table should be setup
      // ...(await weightedSwap.transferWSOLInstructions(keypair0.publicKey, amountIn)),
      ...(await weightedSwap.createIntermediateTokenAccountInstructions(keypair.publicKey, USDC_MINT_KP.publicKey)),
      ...(await weightedSwap.swapInstructions({
        pool: pool_SOL_USDC as WeightedPool,
        mintInAddress: NATIVE_MINT,
        mintOutAddress: USDC_MINT_KP.publicKey,
        amountIn,
        tokenInAddress: keypair0.publicKey,
        tokenOutAddress: keypair.publicKey,
      })),
      ...(await stableSwap.swapInstructions({
        pool: pool_USDC_USDT as StablePool,
        mintInAddress: USDC_MINT_KP.publicKey,
        mintOutAddress: USDT_MINT_KP.publicKey,
        minimumAmountOut,
        tokenInAddress: keypair.publicKey,
      })),
    ];
    const { transaction, recentBlock, slot } = await vaultCtx.createTransaction(instructions);
    await vaultCtx.sendAndConfirmTransaction(transaction, recentBlock, slot, [keypair]);

    const { value: postBalance } = await provider.connection.getTokenAccountBalance(
      weightedSwap.getAssociatedTokenAddress(USDT_MINT_KP.publicKey),
    );
    const usdtAmountOut = postBalance.uiAmount! - balance.uiAmount!;

    console.log("USDT out:", usdtAmountOut);
    // assert.ok(usdtAmountOut <= amountOut * 1.0001);
    assert.ok(usdtAmountOut >= minimumAmountOut);
  });

  it("assert weighted vault balance", async () => {
    const pools = await guestWeightedSwap.findByVault(weightedVault);
    const balances = pools.reduce(
      (result, pool) => {
        for (const token of pool.tokens) {
          const id = token.mintAddress.toBase58();
          if (result[id] === undefined) {
            result[id] = new BN(token.balance.amount);
          } else {
            result[id] = result[id].add(new BN(token.balance.amount));
          }
        }
        return result;
      },
      {} as Record<string, BN>,
    );

    for (const address of Object.keys(balances)) {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        weightedVault.getAuthorityTokenAddress(new PublicKey(address)),
      );
      assert.ok(new BN(balance.amount).gte(balances[address]));
      assert.ok(new BN(balance.amount).sub(balances[address]).lte(new BN(5)));
    }
  });

  it("assert stable vault balance", async () => {
    const pools = await guestStableSwap.findByVault(stableVault);
    const balances = pools.reduce(
      (result, pool) => {
        for (const token of pool.tokens) {
          const id = token.mintAddress.toBase58();
          if (result[id] === undefined) {
            result[id] = new BN(token.balance.amount);
          } else {
            result[id] = result[id].add(new BN(token.balance.amount));
          }
        }
        return result;
      },
      {} as Record<string, BN>,
    );

    for (const address of Object.keys(balances)) {
      const { value: balance } = await provider.connection.getTokenAccountBalance(
        stableVault.getAuthorityTokenAddress(new PublicKey(address)),
      );
      assert.ok(new BN(balance.amount).gte(balances[address]));
      assert.ok(new BN(balance.amount).sub(balances[address]).lte(new BN(10)));
    }
  });
});
