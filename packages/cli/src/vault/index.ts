import type { Command } from "commander";
import { initialize } from "./initialize";
import { swap } from "./swap";
import { check } from "./check";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  swap(program);
  check(program);
};
