import type { Command } from "commander";
import { initialize } from "./initialize";

export const setupWeightedPoolProgram = (program: Command) => {
  initialize(program);
};
