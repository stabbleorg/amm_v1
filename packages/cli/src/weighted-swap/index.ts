import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { swap } from "./swap";

export const setupWeightedSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  swap(program);
};
