/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  rules: {
    // Allow up to 1000 warnings before failing (lenient for gradual migration)
    'max-warnings': 1000,
  },
  ignorePatterns: [
    'refs/',
    'scripts/',
    'subgraph/',
    'node_modules/',
    '.next/',
    'extractions/',
  ],
};
