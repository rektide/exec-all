#!/usr/bin/env node
import { x } from 'tinyexec';

const DIRS = ["/tmp/a", "/tmp/b", "/tmp/c"]
const SEARCH = process.argv[2]

// use tinyexec to execute `ls | rg -SIN $search`, from the cwd of `dir`, to look in each directory and match `search` results with ripgrep.
// make sure we have a shell context here, so we can pipe.
export async function findShallow(dir: string, search: string): Promise<string[]> {
  const result = await x("sh", ["-c", `ls | rg -SIN "${search}"`], { nodeOptions: { cwd: dir } });
  const lines = result.stdout.split("\n").filter(line => line.trim() !== "");
  lines.sort();
  return lines;
}

// want to run `fd $dir`, again looking for `search`, but this time as a deep search.
export async function findDeep(dir: string, search: string): Promise<string[]> {
  const result = await x("fd", [search], { nodeOptions: { cwd: dir } });
  const lines = result.stdout.split("\n").filter(line => line.trim() !== "");
  lines.sort();
  return lines;
}

export function shallowThenDeep(
  dir: string,
  search: string,
  shallowFn: (dir: string, search: string) => Promise<string[]> = findShallow,
  deepFn: (dir: string, search: string) => Promise<string[]> = findDeep
) {
  // first kick off shallow search. 
  const shallow = shallowFn(dir, search)

  // second, call `then` on the shallow results and kick off `deep`.
  // note that we need to call `then` because we can't await. this function needs to return before any work is complete. so no await!
  const deep = shallow.then(async function stage2(shallowResults) {
    const deepResults = await deepFn(dir, search)

    // walk through shallow and deep in order, and put in `result` any matches in `deep` that do not have a matching `shallow` prefix
    const result: string[] = [];
    let shallowCursor = 0;
    let deepCursor = 0;

    while (deepCursor < deepResults.length) {
      const deepItem = deepResults[deepCursor];
      let hasPrefixMatch = false;
      
      // Check shallow items for prefix match
      while (shallowCursor < shallowResults.length && shallowResults[shallowCursor] <= deepItem) {
        if (deepItem.startsWith(shallowResults[shallowCursor])) {
          hasPrefixMatch = true;
          // Don't advance shallowCursor - this shallow item might be prefix of future deep items
          break;
        }
        // shallow[shallowCursor] < deepItem and not a prefix
        // Since deep is sorted, this shallow item can't be prefix of any future deep item
        shallowCursor++;
      }
      
      // If no shallow item matches as a prefix, add deep item to result
      if (!hasPrefixMatch) {
        result.push(deepItem);
      }
      
      deepCursor++;
    }

    return result;
  })

  // finally, return {shallow, deep} with each results
  return {
    shallow,
    deep
  }
}

// run shallowThenDeep for each `dir` in DIRS
// attach a `then` handler to each `shallow` and `deep` that logs the lines, preceeded by a header with the `dir`
function main() {

}
