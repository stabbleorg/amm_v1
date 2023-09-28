import type { Command } from "commander";
import { initialize } from "./initialize";

export const setupStablePoolProgram = (program: Command) => {
  initialize(program);
};
