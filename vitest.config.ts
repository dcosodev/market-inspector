import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "app/**/*.ts"],
      exclude: ["app/api/**/route.ts", "**/*.d.ts", "**/*.test.ts"],
      // Floors set just below current coverage so the suite fails on
      // regression without blocking today's build. Raise as coverage grows.
      thresholds: {
        lines: 25,
        branches: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
