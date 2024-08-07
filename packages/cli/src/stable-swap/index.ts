import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { withdraw } from "./withdraw";
import { swap } from "./swap";
import { changeAmpFactor, changeSwapFee, transferOwner } from "./config";
import { shutdown } from "./shutdown";

export const setupStableSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  withdraw(program);
  swap(program);
  changeAmpFactor(program);
  changeSwapFee(program);
  transferOwner(program);
  shutdown(program);
};
