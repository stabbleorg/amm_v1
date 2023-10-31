import type { Command } from "commander";
import { initialize } from "./initialize";

export const setupSlrProgram = (program: Command) => {
  initialize(program);
};
