module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:json/recommended',
    'plugin:xwalk/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
  },
  overrides: [
    {
      // Build-time importer tooling: runs in node, not the browser, and is
      // allowed to use devDependencies and log to stdout. The transform
      // itself (tools/importer/import.js) is deliberately NOT covered by
      // this override — it ships to the import service and stays strict.
      files: ['tools/importer/*.mjs'],
      env: { browser: false, node: true },
      parserOptions: { ecmaVersion: 2022 },
      rules: {
        'import/extensions': ['error', { js: 'always', mjs: 'always' }],
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        'no-console': 'off',
      },
    },
  ],
};
