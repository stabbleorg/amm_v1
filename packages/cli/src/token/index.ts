import type { Command } from "commander";
import { distribute } from "./distribute";

export const setupTokenProgram = (program: Command) => {
  distribute(program);
};
