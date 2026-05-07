import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["node_modules/**", ".next/**"],
  formatter: {
    indentStyle: "tab",
    indentWidth: 2,
  },
});
