import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { withdraw } from "./withdraw";
import { swap } from "./swap";
import { simulate } from "./simulate";
import { fetchPool } from "./fetchPool";
import { changeAmpFactor, changeSwapFee, changeMaxSupply, transferOwner, acceptOwner, pause, unpause } from "./config";
import { shutdown } from "./shutdown";
import { createStrategy, closeStrategy, execStrategy } from "./strategy";
import { fetchPools } from "./fetchPools";

export const setupStableSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  withdraw(program);
  swap(program);
  simulate(program);
  changeAmpFactor(program);
  changeSwapFee(program);
  changeMaxSupply(program);
  pause(program);
  unpause(program);
  transferOwner(program);
  acceptOwner(program);
  shutdown(program);
  createStrategy(program);
  closeStrategy(program);
  execStrategy(program);
  fetchPool(program);
  fetchPools(program)
};
