import { useMemo, useState } from 'react';
import { ChevronRightIcon, FileTextIcon, ListIcon, LoaderCircleIcon, SearchIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { parseServiceLogs } from '@/lib/service-logs';

const ERROR_LEVELS = ['emergency', 'alert', 'critical', 'fatal', 'error'];

export default function ServiceLogViewer({ content, isLoading, error, hasSelection }: {
  content: string;
  isLoading: boolean;
  error: string | null;
  hasSelection: boolean;
}) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');
  const [order, setOrder] = useState('newest');
  const [view, setView] = useState<'entries' | 'raw'>('entries');
  const entries = useMemo(() => parseServiceLogs(content), [content]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = entries.filter((entry) =>
      (!term || entry.raw.toLowerCase().includes(term)) &&
      (level === 'all' || (level === 'error' ? ERROR_LEVELS.includes(entry.level) : entry.level === level)),
    );
    return order === 'newest' ? matches.reverse() : matches;
  }, [entries, search, level, order]);
  const errorCount = entries.filter((entry) => ERROR_LEVELS.includes(entry.level)).length;

  return (
    <div className="flex min-w-0 flex-col">
      {hasSelection && (
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
              <span className="font-medium">{entries.length} records</span>
              {errorCount > 0 && <Badge variant="danger">{errorCount} errors</Badge>}
              {view === 'entries' && <span className="text-muted-foreground">· {filtered.length} shown</span>}
            </div>
            <div className="flex items-center gap-1 rounded-md border p-1" aria-label="Log display">
              <Button size="sm" variant={view === 'entries' ? 'secondary' : 'ghost'} aria-pressed={view === 'entries'} onClick={() => setView('entries')}>
                <ListIcon /> Records
              </Button>
              <Button size="sm" variant={view === 'raw' ? 'secondary' : 'ghost'} aria-pressed={view === 'raw'} onClick={() => setView('raw')}>
                <FileTextIcon /> Raw
              </Button>
            </div>
          </div>
          {view === 'entries' && (
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search loaded records and stack traces…" aria-label="Search loaded log records" className="pl-9" />
              </div>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-36" aria-label="Log level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  {['warning', 'notice', 'info', 'debug', 'trace', 'unknown'].map((value) => <SelectItem key={value} value={value}>{value === 'unknown' ? 'Unclassified' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={order} onValueChange={setOrder}>
                <SelectTrigger className="w-40" aria-label="Record order"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-muted-foreground text-xs">Timestamps are shown as recorded in the log. Records may be partial at the start of the selected line range.</p>
        </div>
      )}
      {error && <div className="bg-destructive/5 text-destructive border-b p-4 text-sm" role="alert">{error}</div>}
      {!hasSelection || (!content && isLoading) || !entries.length ? (
        <div className="text-muted-foreground flex min-h-80 items-center justify-center gap-2 p-6 text-center text-sm" role="status">
          {isLoading && <LoaderCircleIcon className="size-4 animate-spin" />}
          {!hasSelection ? 'Choose a service and log to get started.' : isLoading ? 'Loading log…' : error ? 'Refresh to try again.' : 'This log is empty.'}
        </div>
      ) : (
        <ScrollArea className="h-[65vh] min-h-80 w-full">
          {view === 'raw' ? (
            <pre className="p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words">{content}</pre>
          ) : filtered.length === 0 ? (
            <div className="text-muted-foreground flex min-h-60 items-center justify-center p-6 text-sm">No records match your search and level filter.</div>
          ) : (
            <div className="divide-y">
              <div className="bg-muted/30 text-muted-foreground hidden gap-4 px-4 py-2 text-xs font-medium sm:flex">
                <span className="w-60 shrink-0">Date & time / Level</span>
                <span>Message</span>
              </div>
              {filtered.map((entry) => (
                <details key={`${entry.id}:${entry.timestamp}:${entry.message}`} className="group">
                  <summary className="hover:bg-muted/40 focus-visible:ring-ring flex cursor-pointer list-none flex-col gap-2 p-4 focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:gap-4 [&::-webkit-details-marker]:hidden">
                    <div className="flex shrink-0 items-center gap-2 sm:w-60 sm:items-start">
                      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90" />
                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
                        {entry.timestamp ? <time className="font-mono text-xs tabular-nums">{entry.timestamp}</time> : <span className="text-muted-foreground text-xs">Timestamp unavailable</span>}
                        <Badge variant={ERROR_LEVELS.includes(entry.level) ? 'danger' : entry.level === 'warning' ? 'warning' : entry.level === 'info' ? 'info' : 'outline'} className="uppercase">{entry.level === 'unknown' ? 'Unclassified' : entry.level}</Badge>
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="line-clamp-3 font-mono text-xs leading-6 break-words">{entry.message}</p>
                      <span className="text-muted-foreground text-xs">{entry.details.length ? `${entry.details.length} detail lines · ` : ''}Click to view full record</span>
                    </div>
                  </summary>
                  <pre className="bg-muted/30 border-t p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words">{entry.raw}</pre>
                </details>
              ))}
            </div>
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      )}
    </div>
  );
}
