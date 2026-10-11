export type LogEntry = {
  id: number;
  timestamp: string | null;
  level: string;
  message: string;
  raw: string;
  details: string[];
};

const LEVELS = /\b(emergency|alert|critical|fatal|error|warning|warn|notice|info|debug|trace)\b/i;
const TIMESTAMP = /^(?:\[)?(\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2}|\s+(?:UTC|GMT))?)(?:\])?\s*/;
const ACCESS_TIMESTAMP = /\[(\d{2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\]/;

export function parseServiceLogs(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')) {
    const timestamp = line.match(TIMESTAMP) ?? line.match(ACCESS_TIMESTAMP);
    if (!timestamp && entries.length > 0 && entries[entries.length - 1].timestamp) {
      const entry = entries[entries.length - 1];
      entry.details.push(line);
      entry.raw += `\n${line}`;
      continue;
    }
    if (!line.trim()) continue;
    const body = timestamp?.index === 0 ? line.slice(timestamp[0].length) : line;
    const levelMatch = body.match(/^(?:[\w.-]+\.)?(EMERGENCY|ALERT|CRITICAL|FATAL|ERROR|WARNING|WARN|NOTICE|INFO|DEBUG|TRACE)(?:\b|:)/i)
      ?? body.match(/^\[(emergency|alert|critical|error|warning|warn|notice|info|debug)\]/i)
      ?? body.match(/^.{0,80}?\b(?:LOG|FATAL|ERROR|WARNING|NOTICE|INFO|DEBUG):/i);
    const level = levelMatch?.[0].match(LEVELS)?.[1].toLowerCase() ?? (levelMatch ? 'info' : 'unknown');
    const message = levelMatch ? body.slice(levelMatch[0].length).replace(/^[:\s]+/, '') : body;
    entries.push({ id: entries.length, timestamp: timestamp?.[1] ?? null, level: level === 'warn' ? 'warning' : level, message, raw: line, details: [] });
  }
  return entries;
}
