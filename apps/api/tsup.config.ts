import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    worker: "src/worker.ts",
    migrate: "src/migrate.ts",
  },
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  /**
   * Bundle the workspace packages (@repo/*) into the output.
   *
   * Why: every @repo/* package exports raw TypeScript source (e.g.
   * `"./client": "./src/client.ts"`) and has no build step of its own.
   * Plain `node dist/index.js` cannot import `.ts`, so leaving them external
   * would break the production container. Bundling inlines their compiled JS.
   *
   * Real npm dependencies stay external and are installed in the runtime
   * image via `pnpm deploy --prod`. The only transitive npm dep pulled in by
   * the bundled workspace code that isn't already a direct dependency of this
   * package is `postgres` (used by @repo/database/client) — it is declared in
   * package.json so the pruned production install resolves it.
   */
  noExternal: [/^@repo\//],
  external: [
    // Native module — must be installed in the runtime image, never bundled.
    "sharp",
  ],
});
