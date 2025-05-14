import type { Command } from "commander";
import { swap } from "./swap";
import { distribute } from "./distribute";

export const setupTokenProgram = (program: Command) => {
  swap(program);
  distribute(program);
};
