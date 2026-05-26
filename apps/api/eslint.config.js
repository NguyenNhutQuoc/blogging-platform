import nodeConfig from "@repo/config-eslint/node";

/** @type {import("typescript-eslint").Config} */
export default [
  ...nodeConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
