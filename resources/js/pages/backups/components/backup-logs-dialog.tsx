import { useCallback, useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ExternalLinkIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { Backup } from '@/types/backup';
import { PaginatedData } from '@/types';
import { ServerLog } from '@/types/server-log';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LogOutput from '@/components/log-output';
import DateTime from '@/components/date-time';
import { useLogContent } from '@/hooks/use-log-content';
import { useSocketListener } from '@/hooks/use-socket-events';
import { isPendingLog } from '@/lib/log';
import { cn, humanizeStep } from '@/lib/utils';

type BackupLogsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backup: Backup;
};

function SelectedLogPane({ log }: { log: ServerLog }) {
  const { content, isLoading, error } = useLogContent({
    serverId: log.server_id,
    logId: log.id,
    enabled: true,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{humanizeStep(log.type) || log.name}</p>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="truncate font-mono">{log.name}</span>
            <span>·</span>
            <DateTime date={log.created_at} className="shrink-0" />
          </p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <a href={`/servers/${log.server_id}/logs/${log.id}/download`} target="_blank" rel="noopener noreferrer">
            <DownloadIcon className="size-3.5" />
            Download
          </a>
        </Button>
      </div>
      <LogOutput className="h-[min(460px,55vh)] rounded-none">
        <>
          {(isLoading || isPendingLog(content)) && (
            <div className="flex h-full min-h-[220px] w-full items-center justify-center py-10">
              <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
            </div>
          )}
          {error && <div className="text-destructive">Error: {error}</div>}
          {!isLoading && !isPendingLog(content) && !error && (content || 'No log output yet.')}
        </>
      </LogOutput>
    </div>
  );
}

export default function BackupLogsDialog({ open, onOpenChange, backup }: BackupLogsDialogProps) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  useSocketListener(
    useCallback(
      (event) => {
        if (!open) {
          return;
        }
        if (event.type?.startsWith('server-log.') && event.type !== 'server-log.content') {
          void queryClient.invalidateQueries({ queryKey: ['backupLogs', backup.id] });
        }
      },
      [open, queryClient, backup.id],
    ),
  );

  const query = useQuery<PaginatedData<ServerLog>>({
    queryKey: ['backupLogs', backup.id, page],
    queryFn: async () => {
      const response = await axios.get<PaginatedData<ServerLog>>(`/servers/${backup.server_id}/backups/${backup.id}/logs`, {
        params: { page },
      });

      return response.data;
    },
    placeholderData: (prev) => prev,
    enabled: open,
  });

  const logs = query.data?.data ?? [];
  const selectedLog = logs.find((item) => item.id === selectedId) ?? logs[0] ?? null;

  useEffect(() => {
    if (logs.length > 0 && !logs.some((item) => item.id === selectedId)) {
      setSelectedId(logs[0].id);
    }
  }, [logs, selectedId]);

  const hasPrev = page > 1;
  const hasNext = Boolean(query.data?.links?.next);
  const targetLabel = backup.pgbackrest?.stanza ?? backup.database?.name ?? `#${backup.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-5xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="px-4 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileTextIcon className="text-muted-foreground size-4" />
            <span>Backup logs</span>
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {targetLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">Backup and restore operation logs</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[min(460px,55vh)] grid-cols-1 md:grid-cols-[270px_minmax(0,1fr)]">
          <div className="flex flex-col border-b md:border-r md:border-b-0">
            <div className="flex max-h-[220px] flex-1 flex-col divide-y overflow-y-auto md:max-h-[min(520px,calc(55vh+56px))]">
              {query.isLoading ? (
                <div className="flex flex-1 items-center justify-center py-12">
                  <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
                </div>
              ) : query.isError ? (
                <div role="alert" className="flex flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                  <span className="text-muted-foreground">Unable to load backup logs.</span>
                  <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                  <FileTextIcon className="size-6 opacity-40" />
                  <span>No backup logs yet.</span>
                </div>
              ) : (
                logs.map((item) => {
                  const active = selectedLog?.id === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'hover:bg-muted/50 flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left transition-colors',
                        active && 'bg-accent/70',
                      )}
                    >
                      <span className="truncate text-xs font-medium text-foreground">
                        {humanizeStep(item.type) || item.name}
                      </span>
                      <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
                        <DateTime date={item.created_at} relative />
                        {item.server_name && (
                          <span className="truncate font-mono">{item.server_name}</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {(hasPrev || hasNext) && (
              <div className="flex items-center justify-between border-t px-2 py-1.5">
                <Button variant="ghost" size="sm" disabled={!hasPrev || query.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeftIcon className="size-3.5" />
                  Prev
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">Page {page}</span>
                <Button variant="ghost" size="sm" disabled={!hasNext || query.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Next
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            {selectedLog ? (
              <SelectedLogPane key={selectedLog.id} log={selectedLog} />
            ) : (
              <div className="text-muted-foreground flex flex-1 items-center justify-center p-8 text-sm">
                Select a log entry to inspect its output.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
            <Link href={`/servers/${backup.server_id}/logs`}>
              <ExternalLinkIcon className="size-3.5" />
              All server logs
            </Link>
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
