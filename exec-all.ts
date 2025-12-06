import process from "node:process";
import { x } from "tinyexec";
import { tokenizeArgs } from "args-tokenizer";

/**
 * Promise.race() that returns the `promise` and `index` of the promise that won the race, as well as the `value`
 */
function raceWithIndex<T>(promises: Iterable<Promise<T>>) {
  // Map each promise with a wrapper that captures the `promise` and `index` while forwarding the `value`.
  // If the promise throws, instead of a `value` there will be an `error`
  const mapped;

  return Promise.race(mapped);
}

export function* raceCmds(cmds = process.argv.slice(2)) {
  // launch cmds phase
  // use arg-tokenizer to parse each cmd into their component tokens
  let tokenized;
  // map each use tinyexec to launch each cmd with it's arguments, saving each promise into
  let running;

  // stream results phase
  let remaining = running;
  // loop through remaining cmd
  while (remaining.length) {
    // race the remaining
    const winner = raceWithIndex(remaining);
    // remove the `winner` from `remaining` via it's `index`
    // yield the winner
    yield winner;
  }
}

export function execAll(cmds = process.argv.slice(2)) {
  for await (let cmd of raceCmds(cmds)) {
    // empty console.error if this is not the first cmd to return, to add visual-separation
    // console.error with the cmd.process.spawnfile so the user can tell
    // actual results
    console.log(cmd.promise.stdout);
  }
}
