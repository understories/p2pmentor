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
  rules: {
    // Downgrade to warning - many files use `any` for Arkiv entity patterns
    // TODO: Gradually fix and upgrade to error
    '@typescript-eslint/no-explicit-any': 'warn',
    // Downgrade unused vars to warning for flexibility
    '@typescript-eslint/no-unused-vars': 'warn',
    // Downgrade prefer-const to warning - many legacy patterns use let
    'prefer-const': 'warn',
    // Downgrade unescaped entities to warning - many legacy strings have quotes
    'react/no-unescaped-entities': 'warn',
    // Downgrade exhaustive-deps to warning - many intentional dependency exclusions
    'react-hooks/exhaustive-deps': 'warn',
    // Downgrade html link warning - some legacy links exist
    '@next/next/no-html-link-for-pages': 'warn',
  },
  overrides: [
    {
      // Disable hooks rule in API routes - functions named use* may not be actual hooks
      files: ['app/api/**/*.ts'],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
  ],
};
