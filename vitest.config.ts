/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Use jsdom for React component testing
    environment: "jsdom",

    // Setup files run before each test file
    setupFiles: ["./vitest.setup.ts"],

    // Where to find tests
    include: ["**/*.{test,spec}.{ts,tsx}"],

    // Ignore these directories
    exclude: ["node_modules", ".next", "refs", "subgraph", "scripts", "e2e"],

    // Coverage configuration with thresholds
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        "refs/**",
        "subgraph/**",
        "**/*.config.*",
        "**/*.d.ts",
      ],
      // Coverage thresholds - start at 0%, raise incrementally as tests are added
      // Current: 0% (baseline - will fail if coverage drops below current level)
      // Goal: Raise to 20% → 40% → 60% → 80% as test suite grows
      // Note: Thresholds prevent backsliding - if you add tests, raise thresholds accordingly
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },

    // Better error messages
    globals: true,
  },

  // Path aliases to match tsconfig
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
});
