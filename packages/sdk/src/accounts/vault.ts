import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { SafeNumber } from "../utils";

export const AMM_VAULT_ID: PublicKey = new PublicKey("vo1tWgqZMjG61Z2T9qUaMYKqZ75CYzMuaZ2LZP1n7HV");

export type VaultData = {
  admin: PublicKey;
  withdrawAuthority: PublicKey;
  withdrawAuthorityBump: number;
  authorityBump: number;
  isActive: boolean;
  beneficiary: PublicKey;
  beneficiaryFee: BN;
  pendingAdmin: PublicKey | null;
};

export class Vault {
  constructor(
    readonly address: PublicKey,
    readonly data: VaultData,
  ) {}

  get adminAddress(): PublicKey {
    return this.data.admin;
  }

  get authorityAddress(): PublicKey {
    return Vault.getAuthorityAddress(this.address);
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

  getAuthorityTokenAddress(mintAddress: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(mintAddress, this.authorityAddress, true);
  }

  getBeneficiaryTokenAddress(mintAddress: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(mintAddress, this.beneficiaryAddress, true);
  }

  static getAuthorityAddress(vaultAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync([Buffer.from("vault_authority"), vaultAddress.toBuffer()], AMM_VAULT_ID)[0];
  }
}
