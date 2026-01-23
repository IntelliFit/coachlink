import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    reporters: ["default", "junit", "json", "html"],
    outputFile: {
      junit: "test-results/vitest/junit.xml",
      json: "test-results/vitest/results.json",
      html: "test-results/vitest/html/index.html",
    },
  },
});

