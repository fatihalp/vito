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
  CodeIcon,
  CpuIcon,
  LayersIcon,
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
  { value: '100', label: '100 satır' },
  { value: '250', label: '250 satır' },
  { value: '500', label: '500 satır' },
  { value: '1000', label: '1000 satır' },
  { value: '2500', label: '2500 satır' },
  { value: '5000', label: '5000 satır' },
];

function StatusIcon({ status }: { status?: string }) {
  if (status === 'running') {
    return <CheckCircle2Icon className="text-success size-5 shrink-0" />;
  }

  if (status === 'stopped') {
    return <XCircleIcon className="text-muted-foreground size-5 shrink-0" />;
  }

  return <LoaderCircleIcon className="text-warning size-5 animate-spin shrink-0" />;
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

  return (
    <>
      <Head title={`Worker Logs · ${worker.name || worker.command} - ${server.name}`} />

      <Container className="max-w-7xl gap-4 py-5 flex flex-col min-h-[calc(100vh-80px)]">
        {/* Top Header Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild className="h-9 gap-1.5 cursor-pointer">
                <Link href={backUrl}>
                  <ArrowLeftIcon className="size-4" />
                  <span>Back to workers</span>
                </Link>
              </Button>

              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusIcon status={worker.status} />
                <h1 className="text-xl font-bold tracking-tight">
                  {worker.name || 'Worker'} Logs
                </h1>
                <Badge variant={worker.status_color || (worker.status === 'running' ? 'success' : 'secondary')}>
                  {worker.status}
                </Badge>
                {worker.is_site_bootstrap && <Badge variant="outline">Site Managed</Badge>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn('h-9 gap-1.5 cursor-pointer text-xs', autoRefresh && 'border-primary/50 text-primary')}
              >
                <RefreshCwIcon className={cn('size-3.5', autoRefresh && query.isFetching && 'animate-spin')} />
                <span>Auto-refresh: {autoRefresh ? 'On' : 'Off'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="h-9 gap-1.5 cursor-pointer text-xs"
              >
                <RefreshCwIcon className={cn('size-3.5', query.isFetching && 'animate-spin')} />
                <span>Refresh</span>
              </Button>

              {!isStopped ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('restart')}
                    disabled={isTransitioning || isActionProcessing !== null}
                    className="h-9 gap-1.5 cursor-pointer text-xs"
                  >
                    {isActionProcessing === 'restart' ? (
                      <LoaderCircleIcon className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCwIcon className="size-3.5" />
                    )}
                    <span>Restart</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction('stop')}
                    disabled={isTransitioning || isActionProcessing !== null}
                    className="h-9 gap-1.5 cursor-pointer text-xs font-medium"
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
                  className="h-9 gap-1.5 cursor-pointer text-xs font-semibold"
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

          {/* Metadata info */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-1.5 font-mono text-foreground">
              <CodeIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-md truncate" title={worker.command}>{worker.command}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <CpuIcon className="size-3.5" />
              <span>{worker.processes} process{worker.processes > 1 ? 'es' : ''}</span>
            </div>

            {worker.queue && (
              <div className="flex items-center gap-1.5">
                <LayersIcon className="size-3.5" />
                <span>Queue: <strong className="text-foreground">{worker.queue}</strong></span>
              </div>
            )}

            {worker.site && (
              <span className="text-muted-foreground">
                Site: <strong className="text-foreground">{worker.site.domain}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Log Controls Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Satır:</span>
            <Select value={lines} onValueChange={setLines}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLogs}
            className="h-8 gap-1.5 cursor-pointer text-xs text-destructive hover:text-destructive"
          >
            <Trash2Icon className="size-3.5" />
            <span>Clear logs</span>
          </Button>
        </div>

        {/* Full Height & Width Log Viewer */}
        <Card className="flex-1 overflow-hidden border flex flex-col min-h-[550px]">
          <LogOutput className="h-[calc(100vh-290px)] min-h-[550px] w-full flex-1 rounded-none border-0 p-4 font-mono text-xs sm:text-sm">
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
