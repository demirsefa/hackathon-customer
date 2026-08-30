import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.yarn/**', 'dist/**', 'coverage/**', '.claude/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Standalone CommonJS tooling that has to run before anything is installed,
    // so its globals are declared here rather than pulled from a package.
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        module: 'writable',
        process: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      // CommonJS is the point of these files, not an oversight.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // The scenario generator, which is standalone for the same reason: it produces
    // committed data and must run with nothing installed. ESM rather than CommonJS,
    // so its globals are declared separately from the block above.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
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
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
    },
  },
  prettier,
);
