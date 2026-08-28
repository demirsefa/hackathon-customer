# Guides — vendored code guidance

Copies of the cross-project guidance this repository is written against, quoted here so
a session can read them without leaving the repo. **Upstream stays the source of truth:**
do not edit the quoted sections — fix them upstream and re-copy.

These are guidance, not project law. Project law lives in
[`dev/contracts/`](contracts/README.md), where every rule carries an enforcement check.

## Sources

| What                           | Upstream                                                                              | Pinned at                                             |
| ------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Code principles, quoted below  | <https://github.com/demirsefa/flowpad-anchor/blob/main/principles/CODE-PRINCIPLES.md> | `demirsefa/flowpad-anchor@66e9efc`, copied 2026-08-28 |
| TypeScript guide, quoted below | <https://github.com/demirsefa/flowpad-anchor/blob/main/guides/typescript.md>          | `demirsefa/flowpad-anchor@66e9efc`, copied 2026-08-28 |
| React guide, quoted below      | <https://github.com/demirsefa/flowpad-anchor/blob/main/guides/react.md>               | `demirsefa/flowpad-anchor@66e9efc`, copied 2026-08-28 |

---

## Code principles

_Every language, every project._

These hold in every session, in every language, without being asked for. They are short
because each one is a rule an agent can be held to, not an essay.

### Hard rules

- **Never swallow errors.** Every `catch` must do something real: handle the error, log
  it, rethrow it, or surface it to the user. An empty `catch {}`, or one that hides what
  happened, is not allowed. Use `try`/`catch` where you actually handle a failure — never
  to mute one.

- **Handle failures, don't hide them.** Validate inputs and check error cases. A crash or
  a bad state must never pass silently.

- **Split by meaning, and find the balance.** Each file or module should be one coherent
  responsibility — a reader should be able to guess its contents from its name. Do not
  shatter code into ten-line files, and do not pile unrelated things into one large one.
  Prefer units that can move as a whole, so renames and splits stay clean. What this buys:
  smaller diffs, fewer merge conflicts, and file names you can navigate by.

- **Best practice versus realistic practice — do not dogmatise.** Every structural
  guideline (file length, splitting, extracting a shared helper, generalising duplicated
  config) is the same trade-off: modelling versus overkill. Generalise repeated logic when
  it removes _real_ duplication; do not abstract a one-off — a shared package for five
  lines is overkill. Rough calibration: a file up to a thousand lines is tolerable, but
  aim well below that; move a genuinely reusable helper into a util, while a hundred tiny
  single-use helpers may read better inline. The target is a structure both a human and an
  agent can take in quickly.

- **Fix the architecture, not just the bug.** When a bug exposes a structural hole — a
  _class_ of mistake the design permits, rather than a one-off — fix the class: a single
  source of truth, a check that goes red, and then the specific fix made _through_ that
  structure. Offer to audit the sibling cases; do not stop at the one that was reported.
  If the human says **"arch > fix"**, they are invoking this explicitly: go
  architecture-first and do not patch the symptom.

- **Comment the why, not the what.** Explain intent, rationale, or the trap that forced
  the design. Never restate what the code already says. Prefer a clear name over a comment
  for the "what" — `checkTokenKeyMatch()` beats three lines of prose. Code is the source
  of truth: if a comment has drifted out of sync, fix it or flag it. Do this unprompted.

- **No dead code.** No unused exports, variables, or branches, and no commented-out blocks
  kept "just in case". Delete them; version control remembers.

- **Prefer early returns** (guard clauses) over deeply nested conditionals.

### Preferences

Judgement, not law — context can justify departing from them.

- **Fail fast on an impossible state.** When code reaches a state it declares cannot
  happen, lean towards throwing rather than limping on with broken data. The sibling of
  _never swallow errors_. Sometimes a safe fallback is the better call, which is why this
  is a preference.

- **Prefer pure functions.** Functions that do not mutate their input and carry no hidden
  side effects are easier to test and to follow.

### Security and operations

- **Never put a secret on a command line.** Writing a value into a `.env` file with
  `echo 'KEY=<secret>' >> .env` lands that secret in shell history — a permanent leak.
  Read it hidden instead, so it is neither echoed to the screen nor stored as a literal:

  ```
  read -rsp "Secret: " V && sed -i "/^KEY=/d" .env && echo "KEY=$V" >> .env && unset V
  ```

  - `read -rs` keeps the value off the screen and out of history; use it for public values
    too, so the habit does not depend on classifying each one.
  - `sed -i` **without a backup suffix**, so no copy of the secret is left behind.
  - Delete-then-append (by key _name_, never by value) keeps it idempotent — no duplicate
    lines on a re-run.
  - It needs an interactive terminal, so run it on the target machine rather than through
    a one-shot remote command.

- **Know which kind of environment variable you are setting.** A build-time variable is
  baked into the bundle at build time, so exporting it in a shell does nothing; a runtime
  variable exported in a shell survives only until the next restart. Either way the value
  belongs in a file the service reads, and a runtime change needs the process restarted
  with the new environment.

- **Deployment carries code, not server configuration.** If a release needs a new
  environment variable, that is a separate manual step — forget it and the deploy is
  quietly half-applied.

---

## TypeScript

_Verified against typescript@5._

### Don't silence the tools

- **No `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error`** to mute the compiler.
  Fix the real type error instead.
- **No `eslint-disable` / `// eslint-disable-next-line`** to hide a lint error.
  Fix the real problem instead.

### Leave the build green

- `tsc` and `eslint` must pass with **no errors** before a change is done. Fix real
  errors — never silence them (see above).
- Formatting is the formatter's job (prettier, auto-applied on commit). Don't
  hand-format or fight the formatter.

### Type the inside, validate the boundary

- **Inside the app, trust the type system.** Internal code is protected by static
  types — no runtime re-checking needed.
- **At every external boundary, types are a lie until checked at runtime.** HTTP
  request/response bodies, env vars, JSON from disk or network, third-party data,
  user input — validate these with a runtime schema (**zod**), don't `as`-cast.
- **Parse, don't assume.** Turn `unknown` input into a typed value with a schema at
  the edge; from there on the rest of the code relies on the inferred type. A bad
  payload should fail loudly at the boundary, not corrupt state three layers in.

### Keep types honest

- **Avoid `any`.** Use a real type. `any` turns off type checking and hides bugs.
- If a value is genuinely not known at compile time, use **`unknown`** and narrow
  it (type guard) before use — never `any`.
- Use `any`, `unknown`, and `never` **as little as possible, ideally never**. If
  one is truly unavoidable, add a short comment saying _why_.

### Clear, stable shapes

- **Annotate return types on public/exported functions.** Don't rely on inference
  for the API surface — an explicit return type keeps callers stable and catches
  mistakes at the source.
- **Prefer a string union (`'a' | 'b'`) over `enum`.** Lighter, tree-shake friendly,
  and more portable (no runtime object).
- **Default to immutability.** Mark props/state/config `readonly` (and arrays
  `readonly T[]`); don't mutate inputs.

---

## React

_Verified against react@18–19. There is no React in this repository today; this section
applies the moment a UI lands._

### Hook dependencies

- **List correct dependencies** in `useEffect`, `useCallback`, and `useMemo`.
  Every value used inside that the effect/callback reads must be in the array.
- **Don't lie to the dependency linter.** Do not disable
  `react-hooks/exhaustive-deps` to make a warning go away.
- If a dependency causes an infinite loop or re-runs too often, **fix the real
  cause** — memoize the value, move logic out, or use a `ref` — instead of
  dropping it from the array.

### State & effects

- **Don't store derived state.** If a value can be computed from existing props or
  state, compute it during render — don't mirror it into `useState` and sync with an
  effect. That sync is a classic bug source.
- **Effects are for external systems only** (data fetch, subscriptions, manual DOM,
  timers). Pure calculation belongs in render, not in `useEffect`.
- **Don't use the array index as `key`** for dynamic lists — it breaks on reorder or
  removal. Use a stable id from the data.

### Keep render pure, memoize sparingly

- **Render must be pure.** No mutation or side effects in the render body — same props
  in, same JSX out. Side effects belong in event handlers or effects.
- **Don't over-memoize.** Reach for `useMemo`/`useCallback` only when you need a stable
  reference (passing to a memoized child or into a dependency array) or for a measured
  cost. Premature memo is noise and a bug source — its own dep array drifts out of sync.
- **Extract shared stateful logic into a custom hook.** Don't copy-paste the same
  effect/state across components.
