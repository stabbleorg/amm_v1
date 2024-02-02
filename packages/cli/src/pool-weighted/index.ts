import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { pause, changeSwapFee } from "./config";

export const setupWeightedPoolProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  pause(program);
  changeSwapFee(program);
};
