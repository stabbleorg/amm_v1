import type { Command } from "commander";
import { initialize } from "./initialize";
import { close } from "./config";

export const setupSmartPoolProgram = (program: Command) => {
  initialize(program);
  close(program);
};
