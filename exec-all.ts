#!/usr/bin/env node
import process from "node:process";
import { type Output, type Result, x } from "tinyexec";
import { tokenizeArgs } from "args-tokenizer";

/**
 * Promise.race() that returns the `promise` and `index` of the promise that won the race, as well as the `value`
 */
function raceWithIndex(promises: Iterable<Result>): Promise<
  & {
    promise: Result;
    index: number;
  }
  & (
    | { value: Output; error?: undefined }
    | { value?: undefined; reason: any }
  )
> {
  // Map each promise with a wrapper that captures the `promise` and `index` while forwarding the `value`.
  // If the promise throws, instead of a `value` there will be an `reason`
  const mapped = promises.map((promise, index) =>
    promise.then(
      (value) => ({ promise, index, value }),
      (reason) => ({ promise, index, reason }),
    )
  );

  return Promise.race(mapped);
}

export async function* raceCmds(cmds: string[] = process.argv.slice(2)) {
  // launch cmds phase
  // use arg-tokenizer to parse each cmd into their component tokens
  // map each use tinyexec to launch each cmd with it's arguments, saving each promise into
  const remaining = cmds.map((cmd: string) => {
    const [command, ...args] = tokenizeArgs(cmd);
    return x(command, args);
  });

  // stream results phase
  // loop through remaining cmd
  while (remaining.length) {
    // race the remaining
    const winner = await raceWithIndex(remaining);
    // remove the `winner` from `remaining` via it's `index`
    remaining.splice(winner.index, 1);
    // yield the winner
    yield winner;
  }
}

export async function execAll(cmds: string[] = process.argv.slice(2)) {
  let firstCmd = true;
  for await (let cmd of raceCmds(cmds)) {
    // empty console.error if this is not the first cmd to return, to add visual-separation
    if (!firstCmd) {
      console.error();
      firstCmd = false;
    }

    // console.error with the cmd.process.spawnfile so the user can tell
    console.error(`  --> ${cmd.promise.process?.spawnargs?.join(" ")}`);

    // actual results
    if ("reason" in cmd) {
      console.error(cmd.reason);
    } else {
      // we need a way to record and reassemble both streams in order
      console.log(cmd.value.stdout);
      if (cmd.value.stderr) {
        console.error(cmd.value.stderr);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  execAll();
}
