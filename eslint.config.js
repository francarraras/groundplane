// Flat ESLint config (#22). A minimal, high-signal baseline — catch real bugs
// (undefined names, unused values, accidental globals, loose equality) without
// bikeshedding style, which Prettier owns.
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "playwright-report/**", "test-results/**", "blob-report/**"],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      // The repo spans a browser app and Node scripts/CLIs; allow both global
      // sets rather than maintaining per-directory environments.
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", ignoreRestSiblings: true, caughtErrors: "none" }],
      "no-undef": "error",
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-constant-condition": ["error", { checkLoops: false }],
    },
  },
];
