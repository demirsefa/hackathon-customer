/**
 * Placeholder module. It exists so the toolchain has something real to
 * typecheck, lint, test and execute end to end before any triage logic lands.
 *
 * It also demonstrates the constraint the project runs under: this file is
 * executed by Node directly, with no build step, so every construct here has to
 * survive plain type stripping.
 */
export function hello(name: string): string {
  return `hello, ${name}`;
}
