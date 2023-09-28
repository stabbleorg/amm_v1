import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";

export const setupWeightedPoolProgram = (program: Command) => {
  initialize(program);
  deposit(program);
};
