import { Keypair } from "@solana/web3.js";

export const adminKP = Keypair.generate();
export const userKP = Keypair.generate();
export const beneficiaryKP = Keypair.generate();

export const weightedVaultKP = Keypair.generate();
export const weightedN2PoolKP = Keypair.generate();
export const weightedN3PoolKP = Keypair.generate();
export const weightedN2PoolMintKP = Keypair.generate();
export const weightedN3PoolMintKP = Keypair.generate();

export const stableVaultKP = Keypair.generate();
export const stableN2PoolKP = Keypair.generate();
export const stableN3PoolKP = Keypair.generate();
export const stableN2PoolMintKP = Keypair.generate();
export const stableN3PoolMintKP = Keypair.generate();

export const swapFee = "0.01";
export const beneficiaryFee = "0.22";
