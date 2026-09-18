import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '**/.venv/**', 'data/**', 'artifacts/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['frontend/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/backend/**'], message: 'Use the HTTP API; frontend code must not import backend internals.' }] }] },
  },
  {
    files: ['shared/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['react', 'react-dom', 'express', 'sql.js', '**/frontend/**', '**/backend/**'], message: 'Shared domain code must stay independent of UI, networking, and persistence.' }] }] },
  },
  {
    files: ['backend/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/frontend/**'], message: 'The backend must not depend on the frontend.' }] }] },
  },
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
