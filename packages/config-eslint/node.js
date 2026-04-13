import baseConfig from "./base.js";

/** @type {import("typescript-eslint").Config} */
export default [
  ...baseConfig,
  {
    rules: {
      // Node.js specific overrides can go here
    },
  },
];
