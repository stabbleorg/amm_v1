import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { WalletContext } from "../wallet";
import { type PoolStable as IDLType, IDL } from "../generated/pool_stable";

export type StablePoolProgram = Program<IDLType>;

export class StablePoolContext<T extends Provider> extends WalletContext<T> {
  readonly program: StablePoolProgram;

  constructor(provider: T, programId?: PublicKey) {
    super(provider);
    this.program = new Program(
      IDL,
      programId || new PublicKey("99TTqzz6CLm1NNjUAbvePk9L2FHSrht53RVaZCWCLryE"),
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
}
