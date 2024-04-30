import type { Command } from "commander";
import { initialize } from "./initialize";
import { check } from "./check";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  check(program);
};
