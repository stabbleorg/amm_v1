import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { withdraw } from "./withdraw";
import { swap } from "./swap";
import { simulate } from "./simulate";
import { changeAmpFactor, changeSwapFee, transferOwner, acceptOwner } from "./config";
import { shutdown } from "./shutdown";

export const setupStableSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  withdraw(program);
  swap(program);
  simulate(program);
  changeAmpFactor(program);
  changeSwapFee(program);
  transferOwner(program);
  acceptOwner(program);
  shutdown(program);
};
