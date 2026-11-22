import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import typescript from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    ignores: ['vendor', 'node_modules', 'public', 'storage', 'bootstrap/ssr', 'tailwind.config.js'],
  },
  {
    files: ['resources/js/lib/ansi.tsx', 'resources/js/lib/log.ts'],
    rules: {
      'no-control-regex': 'off',
    },
  },
  prettier,
];
