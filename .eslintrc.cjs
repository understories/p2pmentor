module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "next/typescript"],
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "out/",
    "refs/",
    "subgraph/",
    "scripts/",
    "*.config.js",
    "*.config.cjs",
    "*.config.ts",
    "postcss.config.cjs",
    "next-env.d.ts",
  ],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "react-hooks/rules-of-hooks": "warn",
    "react-hooks/exhaustive-deps": "warn",
    "react/no-unescaped-entities": "off",
    "@typescript-eslint/triple-slash-reference": "off",
    "@next/next/no-html-link-for-pages": "warn",
    "react/jsx-key": "warn",
    "prefer-const": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "import/order": "off",
  },
  overrides: [
    {
      files: ["app/api/**/*.ts"],
      rules: {
        "react-hooks/rules-of-hooks": "off",
        "react-hooks/exhaustive-deps": "off",
      },
    },
    {
      files: ["lib/**/*.ts", "lib/**/*.tsx"],
      rules: {
        "no-console": "off",
      },
    },
  ],
};

