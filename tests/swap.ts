import { BN } from "bn.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { createAssociatedTokenAccount, getAssociatedTokenAddressSync, mintTo } from "@solana/spl-token";
import {
  VaultContext,
  WeightedPoolContext,
  StablePoolContext,
  SDKWrapper,
  BasePool,
  WeightedPoolToken,
  StablePoolToken,
  WeightedPoolListener,
  StablePoolListener,
  WeightedPool,
  StablePool,
  WeightedPoolData,
  StablePoolData,
  TokenAmountUtil,
} from "@stabbleorg/solana-sdk";
import { stableVaultKP, weightedVaultKP, adminKP, daiMintKP, usdcMintKP, stbMintKP } from "./consts";

describe("Swap", () => {
  const provider = AnchorProvider.env();
  const ctxVault = new VaultContext(provider);
  const ctxWeighted = new WeightedPoolContext(provider);
  const listenerWeighted = new WeightedPoolListener(ctxWeighted.program);
  const ctxStable = new StablePoolContext(provider);
  const listenerStable = new StablePoolListener(ctxStable.program);

  let sdk: SDKWrapper<AnchorProvider>;
  let pools: BasePool<WeightedPoolToken | StablePoolToken, WeightedPoolData | StablePoolData>[];

  before(async () => {
    await mintTo(
      provider.connection,
      adminKP,
      usdcMintKP.publicKey,
      await createAssociatedTokenAccount(provider.connection, adminKP, usdcMintKP.publicKey, provider.publicKey),
      adminKP,
      BigInt("10000000000"), // 10K
    );

    sdk = new SDKWrapper(
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
    const amountIn = 1000;

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
    console.log("Estimated out:", estAmountOut);
    console.log("1 USDC =", estAmountOut / amountIn, "DAI");
    console.log("1 DAI =", amountIn / estAmountOut, "USDC");
    if (estAmountOut === 0) return;
    // slippage tolarance 0.3% (0.003)
    const minAmountOut = estAmountOut * (1 - 0.003);

    const tx = await sdk.swap({
      pool,
      mintInAddress,
      mintOutAddress,
      amountIn,
      minAmountOut,
    });
    await provider.sendAndConfirm(tx);

    const { value: balance } = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(daiMintKP.publicKey, provider.publicKey),
    );
    console.log("DAI out:", balance.uiAmountString);
  });

  it("should swap USDC for STB", async () => {
    const mintInAddress = usdcMintKP.publicKey;
    const mintOutAddress = stbMintKP.publicKey;
    const amountIn = 1000;

    for (let i = 0; i < 9; i++) {
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
      console.log("Estimated out:", estAmountOut);
      console.log("1 USDC =", estAmountOut / amountIn, "STB");
      console.log("1 STB =", amountIn / estAmountOut, "USDC");
      if (estAmountOut === 0) return;
      // slippage tolarance 0.3% (0.003)
      const minAmountOut = estAmountOut * (1 - 0.003);

      if (i > 0) {
        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );

        const tx = await sdk.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minAmountOut,
        });
        await provider.sendAndConfirm(tx);

        const { value: postBalance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );
        console.log(
          "STB out:",
          TokenAmountUtil.toUiAmountString(
            new BN(postBalance.amount!).sub(new BN(balance.amount!)),
            postBalance.decimals,
          ),
        );
      } else {
        const tx = await sdk.swap({
          pool,
          mintInAddress,
          mintOutAddress,
          amountIn,
          minAmountOut,
        });
        await provider.sendAndConfirm(tx);

        const { value: balance } = await provider.connection.getTokenAccountBalance(
          getAssociatedTokenAddressSync(stbMintKP.publicKey, provider.publicKey),
        );
        console.log("STB out:", balance.uiAmountString);
      }
    }
  });
});
