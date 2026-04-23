import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { redis } from "../lib/redis.js";
import { AppError, ErrorCode } from "../lib/errors.js";

function getClientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

/**
 * Sliding window rate limiter backed by Redis sorted sets.
 * Each request is recorded as a member (timestamp:random) with score = timestamp.
 * Old entries outside the window are pruned on every request.
 */
function createRateLimiter(maxRequests: number, windowSec: number, keyPrefix: string) {
  return createMiddleware(async (c, next) => {
    const ip = getClientIp(c);
    const key = `rl:${keyPrefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowSec * 1000;

    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, windowStart);
    pipe.zadd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
    pipe.zcount(key, windowStart, "+inf");
    pipe.expire(key, windowSec + 1);
    const results = await pipe.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count >= maxRequests) {
      throw new AppError(
        ErrorCode.RATE_LIMITED,
        "Too many requests. Please slow down.",
        429
      );
    }

    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - count)));
    c.header("X-RateLimit-Reset", String(Math.ceil((now + windowSec * 1000) / 1000)));

    await next();
  });
}

/** 100 req/min per IP — applied globally */
export const globalRateLimit = createRateLimiter(100, 60, "global");

/** 10 req/min per IP — applied to auth endpoints (sign-in, sign-up, password reset) */
export const authRateLimit = createRateLimiter(10, 60, "auth");
