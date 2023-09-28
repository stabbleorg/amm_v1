import { PublicKey } from "@solana/web3.js";

export type VaultData = {
  admin: PublicKey;
  withdrawAuthority: PublicKey;
  withdrawAuthorityBump: number;
  beneficiary: PublicKey;
  beneficiaryFee: number;
  authorityBump: number;
  isActive: boolean;
};

export class Vault {
  constructor(
    readonly address: PublicKey,
    readonly data: VaultData,
  ) {}

  get adminAddress(): PublicKey {
    return this.data.admin;
  }

  get withdrawAuthorityAddress(): PublicKey {
    return this.data.withdrawAuthority;
  }

  get beneficiaryAddress(): PublicKey {
    return this.data.beneficiary;
  }

  get beneficiaryFee(): number {
    return this.data.beneficiaryFee / 1e4;
  }

  get isActive(): boolean {
    return this.data.isActive;
  }
}
