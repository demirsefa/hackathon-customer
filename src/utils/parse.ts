/**
 * The shape checks every committed file is parsed through.
 *
 * `fixtures/cases.json`, `scenarios/*.json` and the operator block inside a scenario
 * are three different files with three different schemas, and all three answered the
 * same two questions in their own copy of the same eight lines: is this an object, is
 * this a non-empty string. The copies had already begun to drift — one of them called
 * the location a `path`, another a `label`, and a reader had to check which.
 *
 * Bound to a prefix rather than imported loose, because the prefix is the whole value
 * of the message: `cases[3].message must be an object` says nothing until it says
 * which file it is about.
 *
 * Pure, and deliberately so — `src/core/` parses through this, and `src/core/README.md`
 * promises no I/O, no clock and no network in anything it reaches for.
 */

export interface ShapeChecks {
  /**
   * Two arguments where a location and an expectation read better apart, one where the
   * sentence is already whole — `workdays lists day 3 twice` has no expectation half.
   *
   * Take this one as `const fail: ShapeChecks['fail'] = checks.fail` rather than by
   * destructuring: it never returns, and TypeScript only reads that off a name
   * carrying an explicit type annotation. Without one, every caller downstream stops
   * narrowing away the value it just rejected.
   */
  readonly fail: (path: string, expected?: string) => never;
  readonly asRecord: (value: unknown, path: string) => Record<string, unknown>;
  readonly asArray: (value: unknown, path: string) => readonly unknown[];
  readonly asText: (source: Record<string, unknown>, key: string, path: string) => string;
}

export function shapeChecks(prefix: string): ShapeChecks {
  const fail: ShapeChecks['fail'] = (path, expected) => {
    throw new Error(
      `${prefix}: ${expected === undefined ? path : `${path} ${expected}`}`,
    );
  };

  return {
    fail,

    asRecord(value, path): Record<string, unknown> {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        fail(path, 'must be an object');
      }
      return value as Record<string, unknown>;
    },

    asArray(value, path): readonly unknown[] {
      if (!Array.isArray(value)) fail(path, 'must be an array');
      return value as readonly unknown[];
    },

    asText(source, key, path): string {
      const value = source[key];
      if (typeof value !== 'string' || value.length === 0) {
        fail(`${path}.${key}`, 'must be a non-empty string');
      }
      return value;
    },
  };
}
