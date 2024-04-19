import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { SafeNumber } from "../utils";

export type VaultData = {
  admin: PublicKey;
  withdrawAuthority: PublicKey;
  withdrawAuthorityBump: number;
  beneficiary: PublicKey;
  beneficiaryFee: BN;
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
    return SafeNumber.toPercentage(this.data.beneficiaryFee);
  }

  get isActive(): boolean {
    return this.data.isActive;
  }
}
