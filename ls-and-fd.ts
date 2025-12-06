#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { x } from 'tinyexec';
import { cli } from "gunshi";

const DIRS = ["/tmp/a", "/tmp/b", "/tmp/c"]

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
  {
    shallowFn = findShallow,
    deepFn = findDeep
  }: {
    shallowFn?: (dir: string, search: string) => Promise<string[]>;
    deepFn?: (dir: string, search: string) => Promise<string[]>;
  } = {}
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

async function runLsAndFd(search: string, dirs: string[] = DIRS) {
  // Start all searches and attach handlers to print results as they complete
  const promises: Promise<unknown>[] = [];
  
  for (const dir of dirs) {
    const { shallow, deep } = shallowThenDeep(dir, search);
    
    // Handle shallow results when they're ready
    promises.push(
      shallow.then(shallowResults => {
        if (shallowResults.length > 0) {
          console.log(`\n=== ${dir} (shallow) ===`);
          for (const item of shallowResults) {
            console.log(item);
          }
        }
      }).catch(err => {
        console.error(`Error in shallow search for ${dir}:`, err);
      })
    );
    
    // Handle deep results when they're ready (after shallow completes)
    promises.push(
      deep.then(deepResults => {
        if (deepResults.length > 0) {
          console.log(`\n=== ${dir} (deep) ===`);
          for (const item of deepResults) {
            console.log(item);
          }
        }
      }).catch(err => {
        console.error(`Error in deep search for ${dir}:`, err);
      })
    );
  }
  
  // Wait for all searches to complete
  await Promise.allSettled(promises);
}

const command = {
  name: "ls-and-fd",
  description: "Search for files using shallow (ls) then deep (fd) search",
  args: {
    dirs: {
      type: "string" as const,
      description: "Directories to search (comma-separated, default: /tmp/a,/tmp/b,/tmp/c)",
    },
  },
  examples: `
# Search for "test" in default directories
ls-and-fd test

# Search for "*.ts" in specific directories
ls-and-fd "*.ts" --dirs src,lib,tests

# Search for files containing "main"
ls-and-fd main
  `.trim(),
  run: async (ctx: any) => {
    const dirsArg = ctx.values.dirs;
    const dirs = dirsArg ? dirsArg.split(",") : DIRS;
    const search = ctx.positionals[0];

    if (!search) {
      console.error("Error: No search pattern provided");
      console.error("Usage: ls-and-fd <search-pattern> [--dirs dir1,dir2,...]");
      process.exit(1);
    }

    await runLsAndFd(search, dirs);
  },
};


if (import.meta.url === `file://${realpathSync(process.argv[1])}`) {
  cli(process.argv.slice(2), command);
}
