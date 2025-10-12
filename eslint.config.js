import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['dist', 'docs', 'node_modules']
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...js.configs.recommended.languageOptions?.globals,
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        structuredClone: 'readonly',
        __APP_VERSION__: 'readonly',
        __APP_COMMIT__: 'readonly'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/display-name': 'off',
      'react/react-in-jsx-scope': 'off'
    }
  }
];
