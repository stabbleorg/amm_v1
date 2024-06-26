import type { Command } from "commander";
import { initialize } from "./initialize";
import { transferAdmin } from "./config";
import { swap } from "./swap";
import { check } from "./check";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  transferAdmin(program);
  swap(program);
  check(program);
};
