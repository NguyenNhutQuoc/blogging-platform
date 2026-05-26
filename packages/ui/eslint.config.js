import baseConfig from "@repo/config-eslint/base";

/** @type {import("typescript-eslint").Config} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
