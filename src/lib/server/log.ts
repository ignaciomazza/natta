export function logServerError(scope: string, error: unknown) {
  if (error instanceof Error) {
    console.error(`[${scope}] ${error.message}`, error.stack);
    return;
  }

  console.error(`[${scope}] Unknown error`, error);
}
