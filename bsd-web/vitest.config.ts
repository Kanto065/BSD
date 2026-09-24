import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure helpers only. The pages themselves are checked by the production build and in the browser.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { include: ["lib/**/*.test.ts"] },
});
