import type { Command } from "commander";
import { initialize } from "./initialize";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
};
