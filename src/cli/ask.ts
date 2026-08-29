/**
 * The menu a command offers when it is missing an argument only a person can supply.
 *
 * It appears in exactly one situation: `yarn sim` with no scenario, typed by somebody
 * at a terminal. Every command the reproduction guide quotes — `yarn eval`,
 * `yarn sim overload`, either of them with `--live` — is untouched, because a judge
 * who pastes one should meet the run and not a question. A piped or CI invocation
 * does not get the menu either: there the missing argument stays the usage error it
 * has always been, so an unattended run still fails fast instead of hanging on a
 * prompt nobody will answer.
 *
 * That is the whole of the rule. A menu that ever replaces a documented command would
 * be trading reproducibility for convenience, and reproducibility is the thing being
 * scored.
 */
import { select } from '@inquirer/prompts';

export const SCENARIOS = ['normal-day', 'overload'] as const;

export type Scenario = (typeof SCENARIOS)[number];

/** Built from `SCENARIOS` so the usage line cannot drift from what is playable. */
export const USAGE = `usage: yarn sim <scenario> [--live]   (${SCENARIOS.join(' | ')})`;

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
 */
export async function askMode(hasKey: boolean): Promise<boolean> {
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
