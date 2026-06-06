const AUTH_ERRORS = new Set(["UNAUTHORIZED", "FORBIDDEN"]);

export function isAuthError(error: unknown): error is Error {
  return error instanceof Error && AUTH_ERRORS.has(error.message);
}

export function authErrorStatus(error: Error) {
  return error.message === "FORBIDDEN" ? 403 : 401;
}
