import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    worker: "src/worker.ts",
  },
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  // Don't bundle workspace packages or node_modules — keep them as requires
  // so the production container only ships compiled app code.
  noExternal: [],
  external: [
    "@repo/database",
    "@repo/shared",
    "@repo/validators",
    "@repo/api-client",
  ],
});
