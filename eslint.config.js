import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: [
      "node_modules/",
    ],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    }
  },
  {
    plugins: {
      "@stylistic": stylistic,
      "@import": importPlugin,
    },
    files: ["**/*.js", "**/*.ts"],
    rules: {
      "@stylistic/semi": "warn",
      "@stylistic/quotes": ["warn", "double"],
      "@stylistic/indent": ["warn", 2],
      "@import/order": ["warn", {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        alphabetize: { order: "asc", caseInsensitive: true },
        named: true,
      }],
    },
  },
];