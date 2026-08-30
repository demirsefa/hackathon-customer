/**
 * The questions a command asks when nothing on the command line answered them, and
 * the pure decision about whether it is allowed to ask at all.
 *
 * `yarn sim` asks which scenario to play, because it cannot run without one. Both
 * `yarn sim` and `yarn eval` ask how the model should be called when neither
 * `--live` nor `--replay` says, and somebody is at a terminal to answer.
 *
 * The rule is in `src/cli/README.md`, and it is about the documented forms:
 * `yarn eval --replay`, `yarn eval --live`, `yarn sim overload --replay` and
 * `yarn sim overload --live` state their mode, so a judge who pastes one meets the
 * run and not a question. Unattended, nothing is asked either — with no terminal at
 * both ends the mode falls back to replay, the run that costs nothing and needs no
 * key, so a piped or CI invocation finishes instead of hanging on a prompt nobody
 * will answer. `yarn sim` alone is the one exception, and only because it is missing
 * an argument no default can invent: unattended it prints `SIM_USAGE` and stops.
 *
 * `checkArguments` is the other half of the same subject: a word neither command can
 * act on stops the run on a usage line instead of disappearing into a default. Both
 * rules live here because both are about the command line and neither is about a
 * support message.
 */
import { select } from '@inquirer/prompts';

export const LIVE_FLAG = '--live';
export const REPLAY_FLAG = '--replay';

/** The only two options either command takes. Anything else on the line is a typo. */
const FLAGS: readonly string[] = [LIVE_FLAG, REPLAY_FLAG];

export const HELP_FLAGS: readonly string[] = ['--help', '-h'];

export const SCENARIOS = ['normal-day', 'overload'] as const;

export type Scenario = (typeof SCENARIOS)[number];

/** Built from `SCENARIOS` and the flags, so the usage line cannot drift from them. */
export const SIM_USAGE = `usage: yarn sim <scenario> [${LIVE_FLAG} | ${REPLAY_FLAG}]   (${SCENARIOS.join(' | ')})`;

/** The same line for the command that takes no positional argument at all. */
export const EVAL_USAGE = `usage: yarn eval [${LIVE_FLAG} | ${REPLAY_FLAG}]`;

/**
 * What a command answers to, and what it accepts. Held as data rather than as two
 * `if` branches so the rule below is written once and both entry points get the same
 * sentence shape back.
 */
export interface Command {
  /** How a message names it: `yarn eval`. */
  readonly name: string;
  /** Printed under every complaint about it, so a mistake ends on the right form. */
  readonly usage: string;
  /** The positional values it accepts. Empty for a command that takes none. */
  readonly positionals: readonly string[];
  /** What one of those values is called, when there is one to name. */
  readonly noun: string;
}

export const EVAL_COMMAND: Command = {
  name: 'yarn eval',
  usage: EVAL_USAGE,
  positionals: [],
  noun: 'argument',
};

export const SIM_COMMAND: Command = {
  name: 'yarn sim',
  usage: SIM_USAGE,
  positionals: SCENARIOS,
  noun: 'scenario',
};

/**
 * `yarn eval -- --replay` is a form people type out of npm habit, and yarn passes the
 * separator straight through. It means "options end here", so it is dropped rather
 * than reported as an option nobody recognises.
 */
const meaningful = (args: readonly string[]): readonly string[] =>
  args.filter((arg) => arg !== '--');

const quoted = (values: readonly string[]): string =>
  values.map((value) => `\`${value}\``).join(', ');

/**
 * One message when the command line carries something the program does not understand,
 * and `null` when every word on it was recognised.
 *
 * Until this existed a typo was silent. `--lve` is not `--live`, so the command fell
 * through to the bare form and replayed — the safe run, but not the one that was asked
 * for, and nothing said so. `yarn sim overlaod` was worse: it played nothing, printed
 * `scenario: overlaod` and exited 0, which is the one output a reader takes for
 * success. A word this program cannot act on is a usage mistake, and a usage mistake
 * ends on the usage line rather than inside a run.
 */
export function checkArguments(input: {
  readonly args: readonly string[];
  readonly command: Command;
}): string | null {
  const { command } = input;
  const args = meaningful(input.args);
  const complain = (line: string): string => `${command.name}: ${line}\n${command.usage}`;

  const unknownFlags = args.filter(
    (arg) => arg.startsWith('-') && !FLAGS.includes(arg) && !HELP_FLAGS.includes(arg),
  );
  if (unknownFlags.length > 0) {
    return complain(`unknown option ${quoted(unknownFlags)}.`);
  }

  const positionals = args.filter((arg) => !arg.startsWith('-'));

  if (command.positionals.length === 0) {
    return positionals.length === 0
      ? null
      : complain(`it takes no ${command.noun}s, and got ${quoted(positionals)}.`);
  }

  const unrecognised = positionals.filter(
    (value) => !command.positionals.includes(value),
  );
  if (unrecognised.length > 0) {
    return complain(`${quoted(unrecognised)} is not a ${command.noun}.`);
  }

  return positionals.length > 1
    ? complain(`one ${command.noun} at a time, and got ${quoted(positionals)}.`)
    : null;
}

/** `--help` is answered rather than refused: it is a question, not a mistake. */
export function wantsHelp(args: readonly string[]): boolean {
  return meaningful(args).some((arg) => HELP_FLAGS.includes(arg));
}

/**
 * Both flags at once is refused rather than resolved. Either answer would be a guess
 * about which one the person meant, and one of the two guesses spends money.
 */
export const MODE_CONFLICT = `${LIVE_FLAG} and ${REPLAY_FLAG} ask for opposite runs. Pass one of them, or neither.`;

const SCENARIO_HINT: Record<Scenario, string> = {
  'normal-day': 'arrivals a plain weekday brings',
  overload: 'the morning the queue never empties — the primary metric',
};

interface Tty {
  readonly isTTY?: boolean | undefined;
}

/**
 * A menu needs a person at *both* ends of the pipe: something to draw on, and
 * somebody able to answer. `yarn sim | tee log` has a terminal on neither.
 */
export function isInteractive(
  io: { readonly stdin: Tty; readonly stdout: Tty } = process,
): boolean {
  return io.stdin.isTTY === true && io.stdout.isTTY === true;
}

/** Ctrl-C out of a prompt. Not a crash, and it should not print like one. */
export function isCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError';
}

/** `ask` means the menu; the other two are already decided and run straight through. */
export type Mode = 'live' | 'replay' | 'ask';

/** Shaped like `EnvLoad`: one of the two fields carries the answer, the other is null. */
export type ModeChoice =
  | { readonly mode: Mode; readonly error: null }
  | { readonly mode: null; readonly error: string };

/**
 * Flags and the terminal in, mode out. Pure, and the only part of the menu that is
 * worth a test: whether a question happens at all is what a reproduction depends on.
 *
 * The two programs differ in one input and nothing else. `yarn eval` may ask whenever
 * somebody is there to answer; `yarn sim` may ask only when it is already stopping to
 * ask for the scenario it is missing, because naming the scenario has always meant the
 * run starts. So the caller decides `canAsk` and the rule below stays single.
 */
export function resolveMode(input: {
  readonly args: readonly string[];
  readonly canAsk: boolean;
}): ModeChoice {
  const live = input.args.includes(LIVE_FLAG);
  const replay = input.args.includes(REPLAY_FLAG);

  if (live && replay) return { mode: null, error: MODE_CONFLICT };
  if (live) return { mode: 'live', error: null };
  if (replay) return { mode: 'replay', error: null };

  return { mode: input.canAsk ? 'ask' : 'replay', error: null };
}

export async function askScenario(): Promise<Scenario> {
  return select<Scenario>({
    message: 'Which scenario should the player run?',
    choices: SCENARIOS.map((value) => ({
      value,
      name: value,
      description: SCENARIO_HINT[value],
    })),
  });
}

/**
 * Live is offered but held shut without a key, rather than hidden. A menu that
 * silently omits the expensive option teaches that the option does not exist; one
 * that shows it greyed out with the reason teaches what to do next.
 *
 * It takes the key rather than a boolean so that both entry points ask the same
 * question of it, instead of each writing its own idea of what a usable key is.
 */
/**
 * The menu knows what is on the shelf.
 *
 * An empty cache makes replay a choice that cannot succeed: every request misses and
 * the run stops without a number. Offering it as though it might work is how somebody
 * picks it twice. So when nothing is recorded the option says so, live is the answer
 * already selected, and replay is put out of reach — but only when live is actually
 * available, because a menu with no reachable answer is worse than a run that fails
 * with an explanation.
 */
export async function askMode(input: {
  readonly apiKey: string | undefined;
  /** Responses already in fixtures/llm-cache.json. Zero is the case worth naming. */
  readonly recorded: number;
}): Promise<boolean> {
  const hasKey = input.apiKey !== undefined && input.apiKey.length > 0;
  const empty = input.recorded === 0;

  return select<boolean>({
    message: 'How should the model be called?',
    default: empty && hasKey,
    choices: [
      {
        value: false,
        name: 'replay',
        description: empty
          ? 'fixtures/llm-cache.json is empty — nothing recorded yet, so nothing to replay'
          : `${input.recorded} recorded response(s) from fixtures/llm-cache.json — free, no key`,
        disabled:
          empty && hasKey ? '(nothing recorded yet — run live once to record it)' : false,
      },
      {
        value: true,
        name: 'live',
        description: empty
          ? 'real API calls, recorded as they come back — run this once, then commit the cache'
          : 'real API calls, recorded as they come back — costs money',
        disabled: hasKey ? false : '(no ANTHROPIC_API_KEY in the environment)',
      },
    ],
  });
}
