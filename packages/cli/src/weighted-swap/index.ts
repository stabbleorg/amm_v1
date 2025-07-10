import type { Command } from "commander";
import { initialize } from "./initialize";
import { deposit } from "./deposit";
import { withdraw } from "./withdraw";
import { swap } from "./swap";
import { changeSwapFee, changeMaxSupply, pause, unpause, transferOwner, acceptOwner } from "./config";
import { shutdown } from "./shutdown";

export const setupWeightedSwapProgram = (program: Command) => {
  initialize(program);
  deposit(program);
  withdraw(program);
  swap(program);
  changeSwapFee(program);
  changeMaxSupply(program);
  pause(program);
  unpause(program);
  transferOwner(program);
  acceptOwner(program);
  shutdown(program);
};
