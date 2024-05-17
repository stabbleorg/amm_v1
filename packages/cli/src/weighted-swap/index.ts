import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { withdraw } from "./withdraw";
import { swap } from "./swap";
import { shutdown } from "./shutdown";

export const setupWeightedSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  withdraw(program);
  swap(program);
  shutdown(program);
};
