export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ErrorCode = "BAD_REQUEST",
    readonly details?: unknown
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(message, 400, "BAD_REQUEST", details);
}

export function notFound(message: string, details?: unknown): AppError {
  return new AppError(message, 404, "NOT_FOUND", details);
}
