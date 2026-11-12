import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["apps/api/src/generated/**"],
  plugins: ["import", "typescript"],
  rules: {
    "typescript/no-explicit-any": "warn",
    "typescript/no-non-null-assertion": "warn",
    "import/no-cycle": "error",
    "import/no-self-import": "error",
  },
});
