import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    exclude: ["node_modules", ".cache"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
});
