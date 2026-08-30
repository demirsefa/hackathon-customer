import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.yarn/**',
      'dist/**',
      'coverage/**',
      '.claude/**',
      // Linting the lint config with the type-checked rules would need it inside
      // `tsconfig.json`, which covers `src` and nothing else on purpose.
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  // Type-checked, not just syntactic: the rules that matter here (floating
  // promises, unsafe arguments) cannot be decided without the type information.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // The triage pipeline is judged on its decisions, so unused bindings are
      // usually a sign that a signal was computed and then silently dropped.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // A model reply arrives as unknown text and a record arrives as parsed
      // JSON. `any` is how one of them quietly becomes the other.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Every model call is a promise. One left unawaited inside the queue is a
      // reply that leaves without the approval gate ever seeing it.
      '@typescript-eslint/no-floating-promises': 'error',

      eqeqeq: ['error', 'always'],

      // Off: an `async` with no `await` is sometimes the point. A client that
      // rejects where its sibling resolves keeps one failure shape for every
      // caller, instead of a synchronous throw from one and a rejection from
      // the other — see `replayClient` in `src/llm/replay.ts`.
      '@typescript-eslint/require-await': 'off',

      // An object shape is an interface. Type aliases stay for what an interface
      // cannot say: unions, primitives, and shapes derived from a value.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // One shape: declarations for named functions, arrows for callbacks and
      // one-line utilities. `const f = function () {}` is neither.
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      'prefer-arrow-callback': 'error',

      // Named exports only, so a symbol is called the same thing at both ends of
      // the import. No import plugin is installed, hence the syntax selector.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Default export is banned — use a named export.',
        },
      ],
    },
  },
  {
    // `core/` and `llm/` are the pure half: decisions and clients, no terminal.
    // Printing from here is how I/O gets into code that promises it has none.
    // Everywhere else — cli, eval, sim, service, scripts — the terminal is the
    // product, so `console` is the output channel and stays allowed.
    files: ['src/core/**/*.ts', 'src/llm/**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    // Tests and the fakes they share: an in-memory stub is deliberately loose
    // where a fully typed one would only be harder to read.
    files: ['**/*.test.ts', 'src/__test__/fakes.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // Standalone tooling that has to run before anything is installed.
    // It is outside `tsconfig.json`, so the type-aware rules have nothing to read
    // and are switched off here — last, because a later block would turn them
    // back on for the same file.
    files: ['scripts/**/*.cjs', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.commonjs },
    },
    rules: {
      // CommonJS is the point of these files, not an oversight.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  // Last: turns off every rule Prettier already decides, and reports what is
  // left as a lint error. `yarn format:check` still runs on its own, because it
  // covers the Markdown and JSON that ESLint never sees.
  prettierRecommended,
);
