import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import designSystem from './design-system-eslint.mjs';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { 'design-system': designSystem },
    rules: {
      'design-system/semantic-colors': 'error',
      'no-restricted-globals': ['error', ...['confirm', 'alert', 'prompt'].map((name) => ({ name, message: 'Use the shared in-app confirmation modal or an inline field.' }))],
      'no-restricted-properties': ['error', ...['window', 'globalThis'].flatMap((object) => ['confirm', 'alert', 'prompt'].map((property) => ({ object, property, message: 'Use the shared in-app confirmation modal or an inline field.' })))],
    },
  },
);
