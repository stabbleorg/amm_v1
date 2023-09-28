import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { type PoolStable as IDLType, IDL } from "../generated/pool_stable";
import { WalletContext } from "../wallet";
import { StablePool } from "../models";

export type StablePoolProgram = Program<IDLType>;

export class StablePoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: StablePoolProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("CKZnJGq6aCDBccaoZUJkJpgYUVLpoVT51RfYpaMXP37f"),
      provider,
    );
  }

  findPoolAuthorityAddress(poolAddress: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Weighted Pool Authority"), poolAddress.toBuffer()],
      this.program.programId,
    )[0];
  }

  findWithdrawAuthorityAddressAndBump(vaultAddress: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("Withdraw Authority"), vaultAddress.toBuffer()],
      this.program.programId,
    );
  }

  async loadPool(poolAddress: PublicKey): Promise<StablePool> {
    const data = await this.program.account.pool.fetch(poolAddress);
    return new StablePool(poolAddress, data);
  }

  async loadPools(poolAddresses: PublicKey[]): Promise<StablePool[]> {
    return (await this.program.account.pool.fetchMultiple(poolAddresses)).map(
      (data, index) => new StablePool(poolAddresses[index], data!),
    );
  }

  async loadPoolsByVault(vaultAddress: PublicKey): Promise<StablePool[]> {
    const accounts = await this.program.account.pool.all([
      {
        memcmp: {
          offset: 40, // 8+32
          bytes: vaultAddress.toBase58(),
        },
      },
    ]);
    return accounts.map((account) => new StablePool(account.publicKey, account.account));
  }
}
