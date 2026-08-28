export const PENDING_LOG_MESSAGE = "This job hasn't started yet. It's queued and will begin automatically.";

export function appendLogContent(previous: string, chunk: string): string {
  return previous === PENDING_LOG_MESSAGE ? chunk : previous + chunk;
}
