import type { Command } from "commander";
import { createMetadata } from "./metadata";
import { distribute } from "./distribute";

export const setupTokenProgram = (program: Command) => {
  distribute(program);
  createMetadata(program);
};
