import type { Command } from "commander";
import { initialize } from "./initialize";

export const setupSmartPoolProgram = (program: Command) => {
  initialize(program);
};
