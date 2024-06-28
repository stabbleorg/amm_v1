import type { Command } from "commander";
import { initialize } from "./initialize";
import { changeBeneficiary, transferAdmin } from "./config";
import { swap } from "./swap";
import { check } from "./check";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  changeBeneficiary(program);
  transferAdmin(program);
  swap(program);
  check(program);
};
