import { logger } from "hono/logger";

/**
 * Request logger — uses Hono's built-in logger in dev.
 * In production this would pipe to a structured logging service.
 */
export const loggerMiddleware = logger((message, ...rest) => {
  console.log(message, ...rest);
});
