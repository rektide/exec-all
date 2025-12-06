#!/usr/bin/env node
import { realpathSync } from "node:fs"
import process from "node:process"
import Readline from "node:readline"
import { type Readable, Transform } from "node:stream"
import { type Output, type Result, x } from "tinyexec"
import { tokenizeArgs } from "args-tokenizer"
import { cli } from "gunshi"
import ReadlineTransform from "readline-transform"

type OutputAndExec = Output & {
  exec: Result;
  collector?: StreamLinesCollector<CapturedLine>;
};
type Race<T> = {
  promise: Promise<T>;
  index: number;
} & ({ value: T; reason?: undefined } | { value?: undefined; reason: any });

interface ExecAllOptions {
  quiet?: boolean;
}

interface CapturedLine {
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number; // high resolution timestamp
}

class TimestampTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(line: any, encoding: string, callback: Function) {
    this.push({
      line,
      timestamp: performance.now(),
    });
    callback();
  }
}

function createLineTimestampTransform(stream: Readable) {
  const readline = new ReadlineTransform({ skipEmpty: false });
  const timestamp = new TimestampTransform();

  return stream.pipe(readline).pipe(timestamp);
}

class StreamLinesCollector<T> {
  private _lines: (T & { stream: string })[] = [];
  private _activeStreams = new Map<string, Readable>();
  private _resolveCompleted?: () => void;
  private _completedPromise = new Promise<void>((resolve) => {
    this._resolveCompleted = resolve;
  });

  constructor(streams?: Array<{ name: string; stream: Readable }>) {
    if (streams) {
      for (const stream of streams) {
        this.addStream(stream.name, stream.stream);
      }
    }
  }

  addStream(name: string, stream: Readable) {
    this._activeStreams.set(name, stream);
    const transform = createLineTimestampTransform(stream);

    transform.on("data", (data: T) => {
      const inplace = data as unknown as T & { stream: string };
      inplace.stream = name;
      this._lines.push(inplace);
    });

    transform.on("end", () => {
      this._activeStreams.delete(name);
      if (this._activeStreams.size === 0 && this._resolveCompleted) {
        this._resolveCompleted();
      }
    });
  }

  async finished() {
    return await this._completedPromise;
  }

  *[Symbol.iterator]() {
    yield* this._lines;
  }
}

/**
 * Promise.race() that returns the `promise` and `index` of the promise that won the race, as well as the `value`
 */
function raceWithIndex<T>(promises: Iterable<Promise<T>>): Promise<Race<T>> {
  // Map each promise with a wrapper that captures the `promise` and `index` while forwarding the `value`.
  // If the promise throws, instead of a `value` there will be an `reason`
  const mapped = Array.from(promises).map((promise, index) =>
    promise.then(
      (value) => ({ promise, index, value }),
      (reason) => ({ promise, index, reason }),
    )
  );

  return Promise.race(mapped);
}

export async function* raceCmds<T>(
  cmds: string[] = process.argv.slice(2),
): AsyncGenerator<Race<OutputAndExec>, void, undefined> {
  // launch cmds phase
  // use arg-tokenizer to parse each cmd into their component tokens
  // map each use tinyexec to launch each cmd with it's arguments, saving each promise into

  const remaining = cmds.map(async function runCommand(cmd: string) {
    const [command, ...args] = tokenizeArgs(cmd);
    const exec = x(command, args);

    // Create collector for stdout/stderr streams
    const collector = new StreamLinesCollector<CapturedLine>();
    collector.addStream("stdout", exec.process.stdout);
    collector.addStream("stderr", exec.process.stderr);

    const result = (await exec) as unknown as OutputAndExec;
    result.exec = exec;
    result.collector = collector;
    return result;
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

export async function execAll(cmds: string[] = process.argv.slice(2), options: ExecAllOptions = {}) {
  let firstCmd = true;
  for await (let cmd of raceCmds(cmds)) {
    // empty console.error if this is not the first cmd to return, to add visual-separation
    if (!firstCmd && !options.quiet) {
      console.error();
      firstCmd = false;
    }

    // console.error with the cmd.process.spawnfile so the user can tell
    if (!options.quiet) {
      console.error(`  --> ${cmd.value.exec.process.spawnargs?.join(" ")}`);
    }

    // actual results
    if ("reason" in cmd) {
      console.error(cmd.reason);
      continue;
    }

    await cmd.value.collector.finished();
    for (const line of cmd.value.collector) {
      if (line.stream === "stdout") {
        console.log(line.line);
      } else {
        console.error(line.line);
      }
    }
  }
}

const command = {
  name: "exec-all",
  description: "Run multiple programs, see complete results when first available",
  args: {
    quiet: {
      type: "boolean" as const,
      short: "q",
      description: "Quiet mode - don't show separator messages"
    }
  },
  examples: `
# Run two echo commands
exec-all "echo hello" "echo world"

# Run commands quietly
exec-all -q "sleep 1 && echo slow" "echo fast"

# Use shell for complex commands
exec-all "sh -c 'sleep 2 && echo done'" "echo immediate"
  `.trim(),
  run: async (ctx: any) => {
    const { quiet } = ctx.values;
    const commands = ctx.positionals;
    if (!commands || commands.length === 0) {
      console.error("Error: No commands provided");
      console.error("Usage: exec-all [options] <command1> <command2> ...");
      process.exit(1);
    }
    await execAll(commands, { quiet });
  },
};

if (import.meta.url === `file://${realpathSync(process.argv[1])}`) {
  cli(process.argv.slice(2), command)
}
