import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { AlertCircleIcon, RefreshCwIcon, SearchIcon, SkullIcon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDialog } from '@/hooks/use-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Process = {
  pid: number;
  user: string;
  priority: number;
  cpu: number;
  memory: number;
  command: string;
};

type ProcessData = {
  processes: Process[];
  users: string[];
  error?: string | null;
};

type Page = {
  server: Server;
  processes: Process[];
  users: string[];
  error?: string | null;
};

const REFRESH_INTERVALS = [
  { label: 'Auto: Off', value: '0' },
  { label: '5s', value: '5000' },
  { label: '10s', value: '10000' },
  { label: '30s', value: '30000' },
];

function MetricValue({ value }: { value: number }) {
  if (value >= 50) {
    return (
      <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-mono font-medium">
        {value.toFixed(1)}%
      </Badge>
    );
  }
  if (value >= 20) {
    return (
      <Badge variant="warning" className="h-5 px-1.5 text-[10px] font-mono font-medium">
        {value.toFixed(1)}%
      </Badge>
    );
  }
  return (
    <span className={cn('font-mono text-xs', value > 0 ? 'text-foreground' : 'text-muted-foreground/60')}>
      {value.toFixed(1)}%
    </span>
  );
}

export default function Processes() {
  const page = usePage<Page>();
  const { server } = page.props;
  const dialog = useDialog();

  const [data, setData] = useState<ProcessData>({
    processes: page.props.processes,
    users: page.props.users,
    error: page.props.error,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [interval, setIntervalValue] = useState('0');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(route('monitoring.processes.json', { server: server.id }), {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [server.id]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (interval === '0') return;
    timerRef.current = setInterval(fetchProcesses, parseInt(interval));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interval, fetchProcesses]);

  const killProcess = (pid: number) => {
    dialog.confirm.open({
      title: 'Kill Process',
      description: `Process #${pid} will be terminated. Do you want to proceed?`,
      confirmLabel: 'Kill',
      method: 'post',
      url: route('monitoring.processes.kill', { server: server.id }),
      data: { pid },
    });
  };

  const killUserProcesses = () => {
    if (selectedUser === 'all') return;
    dialog.confirm.open({
      title: `Kill all processes for "${selectedUser}"`,
      description: `All processes for user "${selectedUser}" will be terminated. Do you want to proceed?`,
      confirmLabel: 'Kill All',
      method: 'post',
      url: route('monitoring.processes.kill-user', { server: server.id }),
      data: { user: selectedUser },
    });
  };

  const filtered = useMemo(() => {
    return data.processes.filter((p) => {
      if (selectedUser !== 'all' && p.user !== selectedUser) {
        return false;
      }
      if (search.trim() !== '') {
        const q = search.toLowerCase();
        return p.command.toLowerCase().includes(q) || String(p.pid).includes(q) || p.user.toLowerCase().includes(q);
      }
      return true;
    });
  }, [data.processes, selectedUser, search]);

  return (
    <ServerLayout>
      <Head title={`Processes - ${server.name}`} />

      <Container className="max-w-6xl">
        <HeaderContainer>
          <Heading title="Process Manager" description="Running processes on this server, sorted by CPU usage" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                placeholder="Filter command or PID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-44 pl-8 text-xs"
              />
            </div>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {data.users.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedUser !== 'all' && (
              <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={killUserProcesses}>
                <SkullIcon className="size-3.5" />
                Kill {selectedUser}'s
              </Button>
            )}

            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_INTERVALS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" onClick={fetchProcesses} disabled={loading}>
              <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </HeaderContainer>

        {data.error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Unable to fetch processes</p>
                <p className="text-[11px] text-destructive/80 font-mono">{data.error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchProcesses} disabled={loading}>
              <RefreshCwIcon className={cn('size-3', loading && 'animate-spin')} />
              Retry
            </Button>
          </div>
        )}

        <div className="overflow-hidden rounded-md border shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 w-8 px-2 text-center text-xs">#</TableHead>
                <TableHead className="h-8 w-16 px-2 text-xs">PID</TableHead>
                <TableHead className="h-8 w-24 px-2 text-xs">User</TableHead>
                <TableHead className="h-8 w-14 px-2 text-right text-xs">Priority</TableHead>
                <TableHead className="h-8 w-20 px-2 text-right text-xs">CPU %</TableHead>
                <TableHead className="h-8 w-20 px-2 text-right text-xs">Memory %</TableHead>
                <TableHead className="h-8 px-2 text-xs">Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-xs text-muted-foreground">
                    {search ? 'No processes match your filter.' : 'No processes found.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.pid} className="h-8 group hover:bg-muted/40 transition-colors">
                    <TableCell className="px-2 py-1 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => killProcess(p.pid)}
                            className="size-6 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-60 group-hover:opacity-100 transition-opacity"
                            aria-label={`Kill PID ${p.pid}`}
                          >
                            <SkullIcon className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span>Kill process #{p.pid}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono text-xs text-muted-foreground">
                      {p.pid}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-xs font-medium text-foreground truncate max-w-[100px]">
                      {p.user}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right font-mono text-xs text-muted-foreground">
                      {p.priority}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right">
                      <MetricValue value={p.cpu} />
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right">
                      <MetricValue value={p.memory} />
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono text-xs text-foreground/85 max-w-lg truncate" title={p.command}>
                      {p.command}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {filtered.length} process{filtered.length !== 1 ? 'es' : ''} shown
            {selectedUser !== 'all' && ` (user: ${selectedUser})`}
            {search && ` (filter: "${search}")`}
          </span>
          {data.processes.length > 0 && (
            <span>Total: {data.processes.length} processes</span>
          )}
        </div>
      </Container>
    </ServerLayout>
  );
}
