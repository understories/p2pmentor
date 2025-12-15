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
    exclude: ["node_modules", ".next", "refs", "subgraph", "scripts"],

    // Coverage configuration (Phase 3 will add thresholds)
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
