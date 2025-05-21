import type { Command } from "commander";
import { swap } from "./swap";
import { distribute } from "./distribute";
import { thaw } from "./thaw";

export const setupTokenProgram = (program: Command) => {
  swap(program);
  distribute(program);
  thaw(program);
};
