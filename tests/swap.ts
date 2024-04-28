import { assert } from "chai";
import { BN } from "bn.js";
import { AnchorProvider, Provider } from "@coral-xyz/anchor";
import { NATIVE_MINT } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
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

describe("Swap", () => {
  const provider = AnchorProvider.env();
  provider.opts.commitment = "confirmed";
  provider.opts.maxRetries = 1;
  provider.opts.preflightCommitment = "confirmed";
  provider.opts.skipPreflight = true;

  const guestProvider: Provider = { connection: provider.connection };

  const weightedSwap = new WeightedSwapContext(provider);
  const stableSwap = new StableSwapContext(provider);

  const guestVaultCtx = new VaultContext(guestProvider);
  const guestWeightedSwap = new WeightedSwapContext(guestProvider);
  const guestStableSwap = new StableSwapContext(guestProvider);

  const weightedSwapListener = new WeightedSwapListener(guestWeightedSwap.program);
  const stableSwapListener = new StableSwapListener(guestStableSwap.program);

  const pools: Pool<WeightedPoolData | StablePoolData>[] = [];

  before(async () => {
    const vaults = await guestVaultCtx.findAll();
    const weightedVault = vaults.find((vault) => vault.address.equals(WEIGHTED_VAULT_KP.publicKey))!;
    const stableVault = vaults.find((vault) => vault.address.equals(STABLE_VAULT_KP.publicKey))!;

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

  it("should have more balance in vault than in pool", async () => {});
});
