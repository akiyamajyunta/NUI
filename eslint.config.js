// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/**', 'node_modules/**'],
  },
  {
  files: ['src/ui/ManualMaskEditor.tsx'],
  rules: { 'react-hooks/refs': 'off' },
  },
]);
