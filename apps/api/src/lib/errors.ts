/**
 * Application error codes — keeps error handling consistent across
 * service → route → client. Add new codes here as features are built.
 */
export const ErrorCode = {
  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Billing
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  INVALID_COUPON: "INVALID_COUPON",
  SUBSCRIPTION_ALREADY_ACTIVE: "SUBSCRIPTION_ALREADY_ACTIVE",
  STRIPE_ERROR: "STRIPE_ERROR",

  // Server
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Custom error class used throughout the service layer.
 * Routes catch AppError and map it to the standard { success, error } response.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = "Insufficient permissions"): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }

  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500);
  }

  static paymentRequired(message = "A paid subscription is required to access this content"): AppError {
    return new AppError(ErrorCode.PAYMENT_REQUIRED, message, 402);
  }

  static invalidCoupon(message: string): AppError {
    return new AppError(ErrorCode.INVALID_COUPON, message, 422);
  }

  static stripeError(message: string): AppError {
    return new AppError(ErrorCode.STRIPE_ERROR, message, 502);
  }
}
