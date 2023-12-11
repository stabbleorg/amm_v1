import { Keypair } from "@solana/web3.js";

export const adminKP = Keypair.generate();
export const userKP = Keypair.generate();
export const beneficiaryKP = Keypair.generate();

export const usdcMintKP = Keypair.generate(); // 6 decimals
export const usdtMintKP = Keypair.generate(); // 6 decimals
export const daiMintKP = Keypair.generate(); // 8 decimals
export const stbMintKP = Keypair.generate(); // 9 decimals
export const sbrMintKP = Keypair.generate(); // 6 decimals
export const bonkMintKP = Keypair.generate(); // 5 decimals

export const weightedVaultKP = Keypair.generate();
export const weightedN2PoolKP = Keypair.generate();
export const weightedN3PoolKP = Keypair.generate();

export const stableVaultKP = Keypair.generate();
export const stableN2PoolKP = Keypair.generate();
export const stableN3PoolKP = Keypair.generate();

export const usdcPoolKP = Keypair.generate();
