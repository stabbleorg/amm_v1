import type { Command } from "commander";
import { initialize } from "./initialize";
import { distribute } from "./distribute";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  distribute(program);
};
