export const PENDING_LOG_MESSAGE = "This job hasn't started yet. It's queued and will begin automatically.";

export function isPendingLog(content: string): boolean {
  if (!content) return false;
  return content.trim() === PENDING_LOG_MESSAGE;
}

export function appendLogContent(previous: string, chunk: string): string {
  if (!chunk) return previous;
  return isPendingLog(previous) ? chunk : previous + chunk;
}
