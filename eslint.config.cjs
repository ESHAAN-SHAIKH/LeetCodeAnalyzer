const eslint = require('@eslint/js');
const eslintPluginAstro = require('eslint-plugin-astro');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  eslint.configs.recommended,
  ...eslintPluginAstro.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.astro'],
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-console': 'off',
    }
  }
];
