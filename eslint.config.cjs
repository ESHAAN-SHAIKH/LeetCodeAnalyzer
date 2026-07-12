const eslint = require('@eslint/js');
const eslintPluginAstro = require('eslint-plugin-astro');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  eslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.astro'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-console': 'off',
    }
  }
];
