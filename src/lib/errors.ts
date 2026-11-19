/** An expected failure with a user-facing message; route handlers turn it into a JSON error response. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(400, "BAD_REQUEST", message);
export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
export const forbidden = (message: string) => new AppError(403, "FORBIDDEN", message);
// Missing and inaccessible documents look the same, so URLs can't be used to probe which documents exist.
export const documentNotFound = () =>
  new AppError(404, "NOT_FOUND", "This document doesn't exist or you don't have access to it.");
export const tooLarge = (message: string) => new AppError(413, "TOO_LARGE", message);
