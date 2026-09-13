export const PENDING_LOG_MESSAGE = "This job hasn't started yet. It's queued and will begin automatically.";

export function isPendingLog(content: unknown): boolean {
  if (!content || typeof content !== 'string') return false;

  const stripped = content
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)?m/g, '')
    .trim();

  return (
    stripped === PENDING_LOG_MESSAGE ||
    stripped.includes("This job hasn't started yet") ||
    stripped.includes("It's queued and will begin automatically")
  );
}

export function appendLogContent(previous: string, chunk: string): string {
  if (!chunk) return previous;
  return isPendingLog(previous) ? chunk : previous + chunk;
}
