import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LogOutput from '@/components/log-output';
import DateTime from '@/components/date-time';
import { useDialog } from '@/hooks/use-dialog';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from '@/types/server';
import { Worker, WorkerLog } from '@/types/worker';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  HistoryIcon,
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
    history?: WorkerLog[];
  }>();

  const { server } = page.props;
  const worker = useRealtimeRecord<Worker>(page.props.worker, 'worker')!;
  const [activeTab, setActiveTab] = useState<'output' | 'history'>('output');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lines, setLines] = useState('100');
  const [isActionProcessing, setIsActionProcessing] = useState<string | null>(null);
  const dialog = useDialog();

  const query = useQuery({
    queryKey: ['workerLog', worker.id, lines],
    queryFn: async () => {
      const response = await axios.get(`/servers/${server.id}/workers/${worker.id}/logs`, {
        params: { lines },
      });
      return {
        logs: (response.data.logs ?? '') as string,
        history: (response.data.history ?? []) as WorkerLog[],
      };
    },
    initialData: {
      logs: '',
      history: page.props.history ?? [],
    },
    refetchInterval: autoRefresh ? 2500 : false,
  });

  const backUrl = worker.site_id
    ? `/servers/${server.id}/sites/${worker.site_id}/workers`
    : `/servers/${server.id}/workers`;

  const executeAction = (type: 'start' | 'stop' | 'restart') => {
    setIsActionProcessing(type);
    router.post(
      `/servers/${server.id}/workers/${worker.id}/${type}`,
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
        url: `/servers/${server.id}/workers/${worker.id}/stop`,
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
      url: `/servers/${server.id}/workers/${worker.id}/clear-logs`,
    });
  };

  const isStopped = worker.status === 'stopped';
  const isTransitioning = ['starting', 'stopping', 'restarting', 'creating', 'deleting'].includes(worker.status);
  const hasDistinctCommand = worker.name && worker.command && worker.name !== worker.command;
  const historyList = query.data?.history ?? [];

  return (
    <>
      <Head title={`Logs · ${worker.name || worker.command} - ${server.name}`} />

      <Container className="gap-3 py-5 flex flex-col min-h-[calc(100vh-80px)]">
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
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'output' | 'history')}>
                <TabsList className="h-7 bg-muted/60 p-0.5">
                  <TabsTrigger value="output" className="h-6 text-xs px-2.5 gap-1.5">
                    <TerminalIcon className="size-3.5" />
                    <span>Output</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="h-6 text-xs px-2.5 gap-1.5">
                    <HistoryIcon className="size-3.5" />
                    <span>History</span>
                    {historyList.length > 0 && (
                      <span className="text-[10px] bg-background text-foreground px-1 py-0.2 rounded-full font-mono">
                        {historyList.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {activeTab === 'output' && (
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
              )}
            </div>

            <div className="flex items-center gap-1">
              {activeTab === 'output' && (
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
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Refresh"
              >
                <RefreshCwIcon className={cn('size-3.5', query.isFetching && 'animate-spin')} />
              </Button>

              {activeTab === 'output' && (
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
              )}
            </div>
          </div>

          {activeTab === 'output' ? (
            <LogOutput className="h-[calc(100vh-230px)] min-h-[500px] w-full flex-1 rounded-none border-0 p-4 font-mono text-xs sm:text-sm">
              {query.isLoading && 'Loading worker logs...'}
              {query.isError && <span className="text-destructive">Failed to load worker logs.</span>}
              {!query.isLoading && !query.isError && (query.data?.logs || (
                <span className="text-muted-foreground flex items-center gap-2">
                  <TerminalIcon className="size-4" /> No log output available for this worker.
                </span>
              ))}
            </LogOutput>
          ) : (
            <div className="h-[calc(100vh-230px)] min-h-[500px] w-full flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {historyList.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center h-full py-12 gap-2">
                  <HistoryIcon className="size-8 stroke-1 text-muted-foreground/60" />
                  <span className="text-sm">No start/stop history recorded for this worker yet.</span>
                </div>
              ) : (
                <div className="divide-y divide-border border rounded-md overflow-hidden bg-card">
                  {historyList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={item.type_color || 'secondary'} className="capitalize shrink-0 text-xs font-medium">
                          {item.type}
                        </Badge>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm text-foreground truncate font-medium">
                            {item.description || `Worker ${item.type}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {item.user ? `by ${item.user.name} (${item.user.email})` : (item.user_name ? `by ${item.user_name}` : 'by System')}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <DateTime date={item.created_at} className="text-xs text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
