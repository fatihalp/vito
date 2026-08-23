import { useCallback, useEffect, useRef, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import { RefreshCwIcon, SkullIcon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDialog } from '@/hooks/use-dialog';

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
  { label: 'Off', value: '0' },
  { label: '5s', value: '5000' },
  { label: '10s', value: '10000' },
  { label: '30s', value: '30000' },
];

function cpuColor(cpu: number): string {
  if (cpu >= 50) return 'danger';
  if (cpu >= 20) return 'warning';
  return 'default';
}

function memColor(mem: number): string {
  if (mem >= 50) return 'danger';
  if (mem >= 20) return 'warning';
  return 'default';
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
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

  const filtered = selectedUser === 'all'
    ? data.processes
    : data.processes.filter((p) => p.user === selectedUser);

  return (
    <ServerLayout>
      <Head title={`Processes - ${server.name}`} />

      <Container className="max-w-6xl">
        <HeaderContainer>
          <Heading title="Process Manager" description="Running processes on this server, sorted by CPU usage" />
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {data.users.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedUser !== 'all' && (
              <Button variant="destructive" size="sm" onClick={killUserProcesses}>
                <SkullIcon className="size-4" />
                Kill {selectedUser}'s processes
              </Button>
            )}

            <Select value={interval} onValueChange={setIntervalValue}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFRESH_INTERVALS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={fetchProcesses} disabled={loading}>
              <RefreshCwIcon className={cn('size-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </HeaderContainer>

        {data.error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {data.error}
          </div>
        )}

        <div className="overflow-hidden rounded-md border shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-0">Actions</TableHead>
                <TableHead className="w-20">PID</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-20 text-right">Priority</TableHead>
                <TableHead className="w-24 text-right">CPU %</TableHead>
                <TableHead className="w-24 text-right">Memory %</TableHead>
                <TableHead>Command</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No processes found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => killProcess(p.pid)}
                        className="text-destructive hover:text-destructive"
                      >
                        <SkullIcon className="size-3.5" />
                        Kill
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.pid}</TableCell>
                    <TableCell className="font-medium">{p.user}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{p.priority}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={cpuColor(p.cpu) as 'default'}>{p.cpu.toFixed(1)}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={memColor(p.memory) as 'default'}>{p.memory.toFixed(1)}%</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground" title={p.command}>
                      {p.command}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {filtered.length} process{filtered.length !== 1 ? 'es' : ''} shown
          {selectedUser !== 'all' && ` for user "${selectedUser}"`}
        </p>
      </Container>
    </ServerLayout>
  );
}
