/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: [
    'refs/',
    'scripts/',
    'subgraph/',
    'node_modules/',
    '.next/',
    'extractions/',
  ],
};
