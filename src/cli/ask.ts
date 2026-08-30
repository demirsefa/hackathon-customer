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
 * an argument no default can invent: unattended it prints `USAGE` and stops.
 */
import { select } from '@inquirer/prompts';

export const LIVE_FLAG = '--live';
export const REPLAY_FLAG = '--replay';

export const SCENARIOS = ['normal-day', 'overload'] as const;

export type Scenario = (typeof SCENARIOS)[number];

/** Built from `SCENARIOS` and the flags, so the usage line cannot drift from them. */
export const USAGE = `usage: yarn sim <scenario> [${LIVE_FLAG} | ${REPLAY_FLAG}]   (${SCENARIOS.join(' | ')})`;

/**
 * Both flags at once is refused rather than resolved. Either answer would be a guess
 * about which one the person meant, and one of the two guesses spends money.
 */
export const MODE_CONFLICT = `${LIVE_FLAG} and ${REPLAY_FLAG} ask for opposite runs. Pass one of them, or neither.`;

const SCENARIO_HINT: Record<Scenario, string> = {
  'normal-day': 'arrivals a plain weekday brings',
  overload: 'the morning the queue never empties — the primary metric',
};

type Tty = { readonly isTTY?: boolean | undefined };

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
export async function askMode(apiKey: string | undefined): Promise<boolean> {
  const hasKey = apiKey !== undefined && apiKey.length > 0;

  return select<boolean>({
    message: 'How should the model be called?',
    choices: [
      {
        value: false,
        name: 'replay',
        description: 'recorded responses from fixtures/llm-cache.json — free, no key',
      },
      {
        value: true,
        name: 'live',
        description: 'real API calls, recorded as they come back — costs money',
        disabled: hasKey ? false : '(no ANTHROPIC_API_KEY in the environment)',
      },
    ],
  });
}
