import { redis } from "./redis.js";
import { env } from "./env.js";

/**
 * Redis cache-aside helpers for hot, public, read-mostly endpoints.
 *
 * Design rules (see docs/DEPLOYMENT.md → Caching strategy):
 * - Cache only JSON-safe, already-serialised payloads (never raw DB rows with
 *   Date objects — a JSON round-trip would turn Dates into strings).
 * - Cache is best-effort: any Redis error falls through to the loader, so a
 *   Redis outage degrades to "uncached", never to a failed request.
 * - Disabled entirely under NODE_ENV=test for deterministic, isolated tests
 *   (no shared cache state leaking between cases).
 * - Writes invalidate by key prefix; mutations are far rarer than reads, so
 *   clearing a whole namespace on write is an acceptable, simple trade-off.
 */

/** Default TTL for cached public reads (seconds). */
export const DEFAULT_TTL_SECONDS = 300;

/** Namespace prefixes — invalidated as a group on the matching mutation. */
export const CacheKeys = {
  postsList: "cache:posts:list:",
  postDetail: "cache:posts:detail:",
  postsAll: "cache:posts:*",
} as const;

/**
 * Return the cached JSON value for `key`, or run `loader`, cache its result
 * for `ttlSeconds`, and return it.
 */
export async function getCached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  if (env.isTest) return loader();

  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    // Cache read failed — fall through to the loader.
  }

  const value = await loader();

  try {
    if (value !== undefined && value !== null) {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    }
  } catch {
    // Cache write failed — value is still returned to the caller.
  }

  return value;
}

/** Store a value directly under `key` (used when the value is computed conditionally). */
export async function setCached(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (env.isTest) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // best-effort
  }
}

/** Read a value previously stored with setCached / getCached. */
export async function readCached<T>(key: string): Promise<T | null> {
  if (env.isTest) return null;
  try {
    const hit = await redis.get(key);
    return hit !== null ? (JSON.parse(hit) as T) : null;
  } catch {
    return null;
  }
}

/** Delete every key matching a glob pattern using a non-blocking SCAN. */
export async function invalidatePattern(pattern: string): Promise<void> {
  if (env.isTest) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // best-effort — stale entries expire via their TTL anyway
  }
}

/** Invalidate all cached post listings and details. Call on any post mutation. */
export async function invalidatePostCache(): Promise<void> {
  await invalidatePattern(CacheKeys.postsAll);
}
