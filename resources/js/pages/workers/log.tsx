import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import LogOutput from '@/components/log-output';
import { useDialog } from '@/hooks/use-dialog';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from '@/types/server';
import { Worker } from '@/types/worker';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCwIcon,
  TerminalIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LINE_OPTIONS = [
  { value: '100', label: '100 lines' },
  { value: '250', label: '250 lines' },
  { value: '500', label: '500 lines' },
  { value: '1000', label: '1,000 lines' },
  { value: '2500', label: '2,500 lines' },
  { value: '5000', label: '5,000 lines' },
];

function StatusIcon({ status }: { status?: string }) {
  if (status === 'running') {
    return <CheckCircle2Icon className="text-success size-4 shrink-0" />;
  }

  if (status === 'stopped') {
    return <XCircleIcon className="text-muted-foreground size-4 shrink-0" />;
  }

  return <LoaderCircleIcon className="text-warning size-4 animate-spin shrink-0" />;
}

function WorkerLogContent() {
  const page = usePage<{
    server: Server;
    worker: Worker;
  }>();

  const { server } = page.props;
  const worker = useRealtimeRecord<Worker>(page.props.worker, 'worker')!;
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lines, setLines] = useState('100');
  const [isActionProcessing, setIsActionProcessing] = useState<string | null>(null);
  const dialog = useDialog();

  const query = useQuery({
    queryKey: ['workerLog', worker.id, lines],
    queryFn: async () => {
      const response = await axios.get(route('workers.logs', { server: server.id, worker: worker.id }), {
        params: { lines },
      });
      return response.data.logs as string;
    },
    refetchInterval: autoRefresh ? 2500 : false,
  });

  const backUrl = worker.site_id
    ? route('workers.site', { server: server.id, site: worker.site_id })
    : route('workers', { server: server.id });

  const executeAction = (type: 'start' | 'stop' | 'restart') => {
    setIsActionProcessing(type);
    router.post(
      route(`workers.${type}`, { server: server.id, worker: worker.id }),
      {},
      {
        preserveScroll: true,
        onFinish: () => setIsActionProcessing(null),
      },
    );
  };

  const handleAction = (type: 'start' | 'stop' | 'restart') => {
    if (type === 'stop') {
      dialog.confirm.open({
        title: 'Stop worker',
        description: 'Are you sure you want to stop this worker?',
        variant: 'destructive',
        confirmLabel: 'Stop',
        method: 'post',
        url: route('workers.stop', { server: server.id, worker: worker.id }),
      });
      return;
    }

    executeAction(type);
  };

  const handleClearLogs = () => {
    dialog.confirm.open({
      title: 'Clear logs',
      description: 'Are you sure you want to clear all logs for this worker? This action cannot be undone.',
      variant: 'destructive',
      confirmLabel: 'Clear logs',
      method: 'post',
      url: route('workers.clear-logs', { server: server.id, worker: worker.id }),
    });
  };

  const isStopped = worker.status === 'stopped';
  const isTransitioning = ['starting', 'stopping', 'restarting', 'creating', 'deleting'].includes(worker.status);
  const hasDistinctCommand = worker.name && worker.command && worker.name !== worker.command;

  return (
    <>
      <Head title={`Logs · ${worker.name || worker.command} - ${server.name}`} />

      <Container className="max-w-7xl gap-3 py-5 flex flex-col min-h-[calc(100vh-80px)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 shrink-0 text-muted-foreground hover:text-foreground">
              <Link href={backUrl}>
                <ArrowLeftIcon className="size-3.5" />
                <span>Workers</span>
              </Link>
            </Button>

            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <StatusIcon status={worker.status} />
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate" title={worker.name || worker.command}>
                {worker.name || worker.command}
              </h1>
              {hasDistinctCommand && (
                <span className="hidden md:inline-block font-mono text-xs text-muted-foreground truncate max-w-xs" title={worker.command}>
                  {worker.command}
                </span>
              )}
              <Badge variant={worker.status_color || (worker.status === 'running' ? 'success' : 'secondary')} className="capitalize text-xs">
                {worker.status}
              </Badge>
              {worker.is_site_bootstrap && <Badge variant="outline" className="text-xs">Site Managed</Badge>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {!isStopped ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('restart')}
                  disabled={isTransitioning || isActionProcessing !== null}
                  className="h-8 gap-1.5 cursor-pointer text-xs"
                >
                  {isActionProcessing === 'restart' ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCwIcon className="size-3.5" />
                  )}
                  <span>Restart</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('stop')}
                  disabled={isTransitioning || isActionProcessing !== null}
                  className="h-8 gap-1.5 cursor-pointer text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {isActionProcessing === 'stop' ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <PauseIcon className="size-3.5" />
                  )}
                  <span>Stop</span>
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAction('start')}
                disabled={isTransitioning || isActionProcessing !== null}
                className="h-8 gap-1.5 cursor-pointer text-xs font-medium"
              >
                {isActionProcessing === 'start' ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : (
                  <PlayIcon className="size-3.5" />
                )}
                <span>Start</span>
              </Button>
            )}
          </div>
        </div>

        <Card className="flex-1 overflow-hidden border flex flex-col min-h-[550px]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Select value={lines} onValueChange={setLines}>
                <SelectTrigger className="h-7 w-[105px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant={autoRefresh ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
              >
                <span className={cn('size-1.5 rounded-full', autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40')} />
                <span>Auto-refresh</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Refresh logs"
              >
                <RefreshCwIcon className={cn('size-3.5', query.isFetching && 'animate-spin')} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearLogs}
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                title="Clear all logs"
              >
                <Trash2Icon className="size-3.5" />
                <span>Clear</span>
              </Button>
            </div>
          </div>

          <LogOutput className="h-[calc(100vh-230px)] min-h-[500px] w-full flex-1 rounded-none border-0 p-4 font-mono text-xs sm:text-sm">
            {query.isLoading && 'Loading worker logs...'}
            {query.isError && <span className="text-destructive">Failed to load worker logs.</span>}
            {!query.isLoading && !query.isError && (query.data || (
              <span className="text-muted-foreground flex items-center gap-2">
                <TerminalIcon className="size-4" /> No log output available for this worker.
              </span>
            ))}
          </LogOutput>
        </Card>
      </Container>
    </>
  );
}

export default function WorkerLogPage() {
  return (
    <ServerLayout>
      <WorkerLogContent />
    </ServerLayout>
  );
}
