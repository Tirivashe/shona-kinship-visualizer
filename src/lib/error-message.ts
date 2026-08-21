export function errorMessage(cause: unknown, fallback: string) {
  if (cause instanceof Error) {
    const message = cause.message.trim();
    if (message) return message;
  }
  return fallback;
}
