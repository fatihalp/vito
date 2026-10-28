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

const STEP_MARKER = /::vito-step::([\w-]+)::(\d+)(?:::(\d+(?:\.\d+)?))?\r?\n?/g;

export type LogStep = { group: string; line: number };

export function stripStepMarkers(content: string): string {
  return content.replace(STEP_MARKER, '');
}

export function lastStepMarker(content: string): LogStep | null {
  const matches = [...content.matchAll(STEP_MARKER)];
  const last = matches[matches.length - 1];

  return last ? { group: last[1], line: Number(last[2]) } : null;
}

export type LogSegment = LogStep & { output: string; startedAt: number | null; endedAt: number | null };

export function logSegments(content: string): LogSegment[] {
  const matches = [...content.matchAll(STEP_MARKER)];
  return matches.map((match, index) => {
    const next = matches[index + 1];
    return {
      group: match[1],
      line: Number(match[2]),
      startedAt: match[3] ? Number(match[3]) * 1000 : null,
      endedAt: next?.[3] ? Number(next[3]) * 1000 : null,
      output: content.slice(match.index! + match[0].length, next?.index ?? content.length),
    };
  });
}
