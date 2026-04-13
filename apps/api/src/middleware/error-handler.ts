import type { Context } from "hono";
import { AppError } from "../lib/errors.js";
import type { ApiResponse } from "@repo/shared";

/**
 * Global error handler — converts AppError and ZodError into the
 * standard { success: false, error } response shape.
 * Unexpected errors get a generic 500 to avoid leaking internals.
 */
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    const body: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    return c.json(body, err.statusCode as Parameters<typeof c.json>[1]);
  }

  // Zod validation errors from @hono/zod-openapi come through as plain errors
  if (err.name === "ZodError") {
    const body: ApiResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: { issues: JSON.parse(err.message) },
      },
    };
    return c.json(body, 422);
  }

  // Unexpected error — log full details server-side, return generic message
  console.error("[Unhandled Error]", err);
  const body: ApiResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  };
  return c.json(body, 500);
}
