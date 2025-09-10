import type { Command } from "commander";
import { initialize } from "./initialize";
import { createPriceFeed } from "./price-feed";
import { changeBeneficiary, transferAdmin } from "./config";
import { swap } from "./swap";
import { check } from "./check";
import { fetch } from "./fetch";

export const setupVaultProgram = (program: Command) => {
  initialize(program);
  createPriceFeed(program);
  changeBeneficiary(program);
  transferAdmin(program);
  swap(program);
  check(program);
  fetch(program);
};
