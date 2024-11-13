import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import compat from "eslint-plugin-compat";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  compat.configs["flat/recommended"],
  ...tseslint.configs.recommended,
  {
    settings: {
      polyfills: ["URL", "URLSearchParams", "fetch", "Promise"],
    },
  },
];
