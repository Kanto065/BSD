import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure helpers and the wording of the Submit form (rendered to static markup). The pages themselves are
// checked by the production build and in the browser. The JSX setting is explicit because tsconfig keeps JSX for Next.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["lib/**/*.test.ts"] },
});
