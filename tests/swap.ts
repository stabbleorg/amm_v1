import BN from "bn.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { createAssociatedTokenAccount, getAssociatedTokenAddressSync, mintTo } from "@solana/spl-token";
import {
  VaultContext,
  WeightedSwap,
  StableSwap,
  AmmPool,
  WeightedPoolListener,
  StablePoolListener,
  WeightedPool,
  StablePool,
  WeightedPoolData,
  StablePoolData,
  Amm,
  SafeNumber,
} from "@stabbleorg/solana-sdk";
import {
  stableVaultKP,
  weightedVaultKP,
  adminKP,
  daiMintKP,
  usdcMintKP,
  stbMintKP,
  usdtMintKP,
  bonkMintKP,
} from "./consts";

describe("Swap", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(provider);
  const ctxWeighted = new WeightedSwap(provider);
  const listenerWeighted = new WeightedPoolListener(ctxWeighted.program);
  const ctxStable = new StableSwap(provider);
  const listenerStable = new StablePoolListener(ctxStable.program);

  let amm: Amm<AnchorProvider>;
  let pools: AmmPool[];

  before(async () => {
    await mintTo(
      provider.connection,
      adminKP,
      usdcMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, usdcMintKP.publicKey, provider.publicKey),
      adminKP,
      BigInt("50000000000"), // 50K
    );

    amm = new Amm(
      {
        vault: ctxVault,
        weighted: ctxWeighted,
        stable: ctxStable,
      },
      // load vaults initially
      await ctxVault.findMany([stableVaultKP.publicKey, weightedVaultKP.publicKey]),
    );

    // load pools initially and update in real-time via listener
    pools = [
      ...(await ctxWeighted.findManyByVault(weightedVaultKP.publicKey)),
      ...(await ctxStable.findManyByVault(stableVaultKP.publicKey)),
    ];

    listenerWeighted.addPoolListener((evt) => {
      const index = pools.findIndex((pool) => pool.address.equals(evt.pubkey));
      if (index !== -1) {
        pools[index] = new WeightedPool(evt.pubkey, { ...pools[index].data, ...evt.data } as WeightedPoolData);
      }
    });
    listenerStable.addPoolListener((evt) => {
      const index = pools.findIndex((pool) => pool.address.equals(evt.pubkey));
      if (index !== -1) {
        pools[index] = new StablePool(evt.pubkey, { ...pools[index].data, ...evt.data } as StablePoolData);
      }
    });
  });

  after(() => {
    listenerWeighted.removePoolListener();
    listenerStable.removePoolListener();
  });

  it("should swap USDC for DAI", async () => {
    const mintInAddress = usdcMintKP.publicKey;
    const mintOutAddress = daiMintKP.publicKey;
    const amountIn = 10000;

    // select the best route
    const pool = pools.sort(
      (a, b) =>
        b.getEstAmountOut(mintInAddress, mintOutAddress, amountIn) -
        a.getEstAmountOut(mintInAddress, mintOutAddress, amountIn),
    )[0];
    if (!pool) {
      console.log("No route found");
      return;
    }
    console.log("Swap @", pool.address.toBase58());

    const estAmountOut = pool.getEstAmountOut(mintInAddress, mintOutAddress, amountIn);
    console.log("1 USDC =", estAmountOut / amountIn, "DAI");
    console.log("1 DAI =", amountIn / estAmountOut, "USDC");
    console.log("Estimated out:", estAmountOut);
    if (estAmountOut === 0) return;
    // slippage tolarance 0.3% (0.003)
    const minimumAmountOut = estAmountOut * (1 - 0.003);

    const { transaction } = await amm.swap({
      pool,
      mintInAddress,
      mintOutAddress,
      amountIn,
      minimumAmountOut,
    });
    await provider.sendAndConfirm(transaction);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(daiMintKP.publicKey, provider.publicKey),
    );
    console.log("DAI out:", balance.uiAmountString);
  });

  it("should swap USDC for USDT", async () => {
    const mintInAddress = usdcMintKP.publicKey;
    const mintOutAddress = usdtMintKP.publicKey;
    const amountIn = 10000;

    // select the best route
    const pool = pools.sort(
      (a, b) =>
        b.getEstAmountOut(mintInAddress, mintOutAddress, amountIn) -
        a.getEstAmountOut(mintInAddress, mintOutAddress, amountIn),
    )[0];
    if (!pool) {
      console.log("No route found");
      return;
    }
    console.log("Swap @", pool.address.toBase58());

    const estAmountOut = pool.getEstAmountOut(mintInAddress, mintOutAddress, amountIn);
    console.log("1 USDC =", estAmountOut / amountIn, "USDT");
    console.log("1 USDT =", amountIn / estAmountOut, "USDC");
    console.log("Estimated out:", estAmountOut);
    if (estAmountOut === 0) return;
    // slippage tolarance 0.3% (0.003)
    const minimumAmountOut = estAmountOut * (1 - 0.003);

    const { transaction } = await amm.swap({
      pool,
      mintInAddress,
      mintOutAddress,
      amountIn,
      minimumAmountOut,
    });
    await provider.sendAndConfirm(transaction);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(usdtMintKP.publicKey, provider.publicKey),
    );
    console.log("USDT out:", balance.uiAmountString);
  });

  it("should swap USDC for STB", async () => {
    const mintInAddress = usdcMintKP.publicKey;
    const mintOutAddress = stbMintKP.publicKey;
    const amountIn = 1000;

    for (let i = 0; i < 10; i++) {
      // select the best route
      const pool = pools.sort(
        (a, b) =>
          b.getEstAmountOut(mintInAddress, mintOutAddress, amountIn) -
          a.getEstAmountOut(mintInAddress, mintOutAddress, amountIn),
      )[0];
      if (!pool) {
        console.log("No route found");
        return;
      }
      console.log("Swap @", pool.address.toBase58());

      const estAmountOut = pool.getEstAmountOut(mintInAddress, mintOutAddress, amountIn);
      console.log("1 USDC =", estAmountOut / amountIn, "STB");
      console.log("1 STB =", amountIn / estAmountOut, "USDC");
      console.log("Estimated out:", estAmountOut);
      if (estAmountOut === 0) return;
      // slippage tolarance 0.3% (0.003)
      const minimumAmountOut = estAmountOut * (1 - 0.003);

      if (i > 0) {
        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );

        const { transaction } = await amm.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minimumAmountOut,
        });
        await provider.sendAndConfirm(transaction);

        const { value: postBalance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );
        console.log(
          "STB out:",
          SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
        );
      } else {
        const { transaction } = await amm.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minimumAmountOut,
        });
        await provider.sendAndConfirm(transaction);

        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );
        console.log("STB out:", balance.uiAmountString);
      }
    }
  });

  it("should swap USDC for BONK", async () => {
    const mintInAddress = usdcMintKP.publicKey;
    const mintOutAddress = bonkMintKP.publicKey;
    const amountIn = 1000;

    for (let i = 0; i < 10; i++) {
      // select the best route
      const pool = pools.sort(
        (a, b) =>
          b.getEstAmountOut(mintInAddress, mintOutAddress, amountIn) -
          a.getEstAmountOut(mintInAddress, mintOutAddress, amountIn),
      )[0];
      if (!pool) {
        console.log("No route found");
        return;
      }
      console.log("Swap @", pool.address.toBase58());

      const estAmountOut = pool.getEstAmountOut(mintInAddress, mintOutAddress, amountIn);
      console.log("1 USDC =", (estAmountOut / amountIn).toFixed(5), "Bonk");
      console.log("1 Bonk =", (amountIn / estAmountOut).toFixed(9), "USDC");
      console.log("Estimated out:", estAmountOut);
      if (estAmountOut === 0) return;
      // slippage tolarance 0.3% (0.003)
      const minimumAmountOut = estAmountOut * (1 - 0.003);

      if (i > 0) {
        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(bonkMintKP.publicKey, provider.publicKey),
        );

        const { transaction } = await amm.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minimumAmountOut,
        });
        await provider.sendAndConfirm(transaction);

        const { value: postBalance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(bonkMintKP.publicKey, provider.publicKey),
        );
        console.log(
          "Bonk out:",
          SafeNumber.toUiAmountString(new BN(postBalance.amount!).sub(new BN(balance.amount!)), postBalance.decimals),
        );
      } else {
        const { transaction } = await amm.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minimumAmountOut,
        });
        await provider.sendAndConfirm(transaction);

        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(bonkMintKP.publicKey, provider.publicKey),
        );
        console.log("Bonk out:", balance.uiAmountString);
      }
    }
  });

  it("should match liquidity with reserves in weighted vault", async () => {
    const vaultAuthorityAddress = amm.ctxVault.findVaultAuthorityAddress(amm.vaults[1].address);

    const liqSTB = pools
      .filter((pool) => pool.vaultAddress.equals(amm.vaults[1].address))
      .reduce(
        (liquidity, pool) =>
          (pool.tokens.find((token) => token.mintAddress.equals(stbMintKP.publicKey))?.balance || 0) + liquidity,
        0,
      );
    const {
      value: { uiAmount: balSTB },
    } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(stbMintKP.publicKey, vaultAuthorityAddress, true),
    );
    console.log("STB Balance:", liqSTB);
    console.log("STB Reserve:", balSTB);

    const liqBonk = pools
      .filter((pool) => pool.vaultAddress.equals(amm.vaults[1].address))
      .reduce(
        (liquidity, pool) =>
          (pool.tokens.find((token) => token.mintAddress.equals(bonkMintKP.publicKey))?.balance || 0) + liquidity,
        0,
      );
    const {
      value: { uiAmount: balBonk },
    } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(bonkMintKP.publicKey, vaultAuthorityAddress, true),
    );
    console.log("Bonk Balance:", liqBonk);
    console.log("Bonk Reserve:", balBonk);

    const liqUSDC = pools
      .filter((pool) => pool.vaultAddress.equals(amm.vaults[1].address))
      .reduce(
        (liquidity, pool) =>
          (pool.tokens.find((token) => token.mintAddress.equals(usdcMintKP.publicKey))?.balance || 0) + liquidity,
        0,
      );
    const {
      value: { uiAmount: balUSDC },
    } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(usdcMintKP.publicKey, vaultAuthorityAddress, true),
    );
    console.log("USDC Balance:", liqUSDC);
    console.log("USDC Reserve:", balUSDC);
  });

  it("should match liquidity with reserves in stable vault", async () => {
    const vaultAuthorityAddress = amm.ctxVault.findVaultAuthorityAddress(amm.vaults[0].address);

    const liqUSDC = pools
      .filter((pool) => pool.vaultAddress.equals(amm.vaults[0].address))
      .reduce(
        (liquidity, pool) =>
          (pool.tokens.find((token) => token.mintAddress.equals(usdcMintKP.publicKey))?.balance || 0) + liquidity,
        0,
      );
    const {
      value: { uiAmount: balUSDC },
    } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(usdcMintKP.publicKey, vaultAuthorityAddress, true),
    );
    console.log("USDC Balance:", liqUSDC);
    console.log("USDC Reserve:", balUSDC);
  });
});
