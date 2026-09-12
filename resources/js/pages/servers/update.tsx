import { useCallback, useEffect, useRef, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  TerminalIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import { ServerLog } from '@/types/server-log';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClipboard } from '@/hooks/use-clipboard';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { useLogContent } from '@/hooks/use-log-content';
import { cn } from '@/lib/utils';

type PageProps = {
  server: Server;
  initialLog: ServerLog | null;
};

export default function ServerUpdate() {
  const { server: initialServer, initialLog } = usePage<PageProps>().props;
  const server = useRealtimeRecord<Server>(initialServer, 'server') ?? initialServer;

  const [activeLogId, setActiveLogId] = useState<number>(() => {
    return server.status === 'updating' && initialLog?.id ? initialLog.id : initialLog?.id ?? 0;
  });
  const [updateType, setUpdateType] = useState<'os' | 'kernel'>('os');
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [isCleared, setIsCleared] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const { copied, copy } = useClipboard();

  const { content, isLoading, error: logError } = useLogContent({
    serverId: server.id,
    logId: activeLogId,
    enabled: activeLogId > 0 && !isCleared,
  });

  const isUpdating = server.status === 'updating' || isTriggering;
  const rebootRequired = (server.warnings ?? []).some((w) => w.key === 'reboot_required');

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [content, isUpdating]);

  const triggerUpdate = useCallback(
    async (type: 'os' | 'kernel' = 'os') => {
      if (server.status === 'updating' || isTriggering) return;

      setIsTriggering(true);
      setTriggerError(null);
      setIsCleared(false);
      setUpdateType(type);

      try {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const response = await fetch(route('servers.update.trigger', { server: server.id }), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': token,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
          body: JSON.stringify({ type }),
        });

        if (!response.ok) {
          throw new Error(`Failed to initiate update (HTTP ${response.status})`);
        }

        const data = await response.json();
        if (data.log?.id) {
          setActiveLogId(data.log.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to trigger package update';
        setTriggerError(message);
      } finally {
        setIsTriggering(false);
      }
    },
    [isTriggering, server.id, server.status]
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('start') === '1' || params.get('auto') === '1') {
      const type = params.get('type') === 'kernel' ? 'kernel' : 'os';
      window.history.replaceState(null, '', window.location.pathname);
      triggerUpdate(type);
    }
  }, [triggerUpdate]);

  const copyAllLogs = () => {
    copy(content || '');
  };

  const clearLogs = () => {
    setIsCleared(true);
  };

  return (
    <ServerLayout>
      <Head title={`Update Packages - ${server.name}`} />

      <Container className="max-w-5xl space-y-3.5 py-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 cursor-pointer">
            <Link href={route('servers.show', { server: server.id })}>
              <ArrowLeftIcon className="size-3.5" />
              <span>Overview</span>
            </Link>
          </Button>

          <div>
            {isUpdating ? (
              <Badge variant="warning" className="gap-1.5 px-2.5 py-1 text-xs">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                <span>Updating {updateType === 'kernel' ? 'kernel' : 'packages'}...</span>
              </Badge>
            ) : server.updates > 0 ? (
              <Badge variant="warning" className="gap-1.5 px-2.5 py-1 text-xs">
                {server.updates} {server.updates === 1 ? 'update' : 'updates'} available
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs text-emerald-600 border-emerald-500/30 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3 text-emerald-500" />
                <span>Up to date</span>
              </Badge>
            )}
          </div>
        </div>

        {rebootRequired && !isUpdating && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCwIcon className="size-4 shrink-0 text-amber-500" />
              <span className="truncate">A restart is required to apply kernel or core system updates.</span>
            </div>
            <Button size="sm" asChild className="h-7 text-xs shrink-0 cursor-pointer" variant="outline">
              <Link href={route('servers.restart', { server: server.id, start: 1 })}>
                Restart server
              </Link>
            </Button>
          </div>
        )}

        {triggerError && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <XCircleIcon className="size-4 shrink-0 text-rose-500" />
            <p className="font-medium">{triggerError}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/50 bg-card px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={isUpdating}
              onClick={() => triggerUpdate('os')}
              className={cn(
                'h-7.5 text-xs gap-1.5 cursor-pointer font-medium',
                isUpdating && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isUpdating ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <RefreshCwIcon className="size-3.5" />
                  <span>{server.updates > 0 ? `Update ${server.updates} packages` : 'Update packages'}</span>
                </>
              )}
            </Button>

            {server.kernel_updates > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => triggerUpdate('kernel')}
                className="h-7.5 text-xs gap-1.5 cursor-pointer border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
              >
                <RefreshCwIcon className="size-3" />
                <span>Update kernel &amp; restart</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={isUpdating}
              asChild
              className="h-7.5 text-xs gap-1.5 cursor-pointer"
            >
              <Link
                href={route('servers.check-for-updates', server.id)}
                method="post"
                as="button"
              >
                <RefreshCwIcon className="size-3" />
                <span>Check for updates</span>
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {activeLogId > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                asChild
                title="Download log file"
                aria-label="Download log"
              >
                <a
                  href={route('logs.download', { server: server.id, log: activeLogId })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DownloadIcon className="size-3.5" />
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={copyAllLogs}
              title="Copy terminal logs"
              aria-label="Copy logs"
            >
              {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={clearLogs}
              title="Clear terminal logs"
              aria-label="Clear logs"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-neutral-950 text-neutral-100">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-3.5 py-2 select-none">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-3.5 text-neutral-500" />
              <span className="font-mono text-xs text-neutral-400">
                {server.ssh_user || 'root'}@{server.ip}
              </span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">apt</span>
          </div>

          <div className="h-[480px] overflow-y-auto p-4 font-mono text-xs leading-relaxed select-text">
            {isLoading && (
              <div className="flex items-center gap-2 text-neutral-400">
                <LoaderCircleIcon className="size-3.5 animate-spin shrink-0" />
                <span>Loading logs...</span>
              </div>
            )}

            {logError && (
              <div className="text-rose-400">
                Error loading log: {logError}
              </div>
            )}

            {!isLoading && !logError && !content && isUpdating && (
              <div className="flex items-center gap-2 text-amber-400/90">
                <LoaderCircleIcon className="size-3.5 animate-spin shrink-0" />
                <span>Connecting to server and running update...</span>
              </div>
            )}

            {!isLoading && !logError && !content && !isUpdating && (
              <div className="text-neutral-500">
                {server.updates > 0
                  ? `${server.updates} package updates available. Click "Update packages" to apply.`
                  : 'Ready. No package updates pending.'}
              </div>
            )}

            {content && !isCleared && (
              <div className="text-neutral-200 whitespace-pre-wrap break-all">
                {content}
              </div>
            )}

            {isUpdating && content && (
              <div className="flex items-center gap-2 text-amber-400/90 pt-2 border-t border-neutral-800/60 mt-2">
                <LoaderCircleIcon className="size-3.5 animate-spin shrink-0" />
                <span>Applying updates in real time...</span>
              </div>
            )}

            <div ref={terminalEndRef} />
          </div>
        </div>
      </Container>
    </ServerLayout>
  );
}
