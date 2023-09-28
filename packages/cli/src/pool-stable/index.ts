import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";

export const setupStablePoolProgram = (program: Command) => {
  initialize(program);
  deposit(program);
};
