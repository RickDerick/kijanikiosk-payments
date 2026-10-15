const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Generated or downloaded files are never linted
  { ignores: ['dist/', 'coverage/', 'test-results/', 'node_modules/', '.npm/'] },

  // Recommended rules catch real bugs: undefined or unused variables,
  // unreachable code, duplicate keys
  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
