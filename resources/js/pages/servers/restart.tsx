import { useCallback, useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  PowerIcon,
  RefreshCwIcon,
  TerminalIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useRealtimeRecord } from '@/hooks/use-socket-events';

type PageProps = {
  server: Server;
};

type RestartPhase = 'idle' | 'rebooting' | 'probing' | 'online';

type Milestone = {
  id: string;
  time: string;
  text: string;
};

export default function ServerRestart() {
  const { server: initialServer } = usePage<PageProps>().props;
  const server = useRealtimeRecord<Server>(initialServer, 'server') ?? initialServer;

  const [phase, setPhase] = useState<RestartPhase>(
    server.status === 'disconnected' ? 'probing' : 'idle'
  );
  const [probeAttempt, setProbeAttempt] = useState<number>(0);
  const [uptime, setUptime] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [milestones, setMilestones] = useState<Milestone[]>(() => {
    const now = new Date().toLocaleTimeString();
    if (server.status === 'disconnected') {
      return [{ id: 'init-0', time: now, text: 'Server is currently disconnected. Probing for reconnection.' }];
    }
    return [];
  });

  const addMilestone = useCallback((text: string) => {
    const time = new Date().toLocaleTimeString();
    setMilestones((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, time, text }]);
  }, []);

  const probeConnection = useCallback(async (): Promise<boolean> => {
    try {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
      const response = await fetch(route('servers.restart.probe', { server: server.id }), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      if (!response.ok) return false;

      const data = await response.json();

      if (data.online) {
        setUptime(data.uptime ?? null);
        addMilestone('SSH connection established. Server is back online.');
        setPhase('online');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [addMilestone, server.id]);

  const triggerReboot = useCallback(async () => {
    setPhase('rebooting');
    setProbeAttempt(0);
    setUptime(null);
    setMilestones([{ id: `${Date.now()}`, time: new Date().toLocaleTimeString(), text: 'Reboot signal sent ($ sudo reboot)' }]);

    try {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
      await fetch(route('servers.restart.trigger', { server: server.id }), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });
    } catch {
    }

    setPhase('probing');
  }, [server.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('start') === '1' || params.get('auto') === '1') {
      window.history.replaceState(null, '', window.location.pathname);
      triggerReboot();
    }
  }, [triggerReboot]);

  useEffect(() => {
    if (phase !== 'probing') return;

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const runProbe = async () => {
      setProbeAttempt((c) => c + 1);
      const isOnline = await probeConnection();
      if (isOnline || !isMounted) return;
      timer = setTimeout(runProbe, 2500);
    };

    timer = setTimeout(runProbe, 2000);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, probeConnection]);

  return (
    <ServerLayout>
      <Head title={`Restart Server - ${server.name}`} />

      <Container className="max-w-md space-y-4 py-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground h-8 px-2 cursor-pointer">
            <Link href={route('servers.show', { server: server.id })}>
              <ArrowLeftIcon className="size-3.5" />
              <span>Overview</span>
            </Link>
          </Button>

          <div>
            {phase === 'online' ? (
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-500/30 dark:text-emerald-400">
                <CheckCircle2Icon className="size-3 text-emerald-500" />
                <span>Online</span>
              </Badge>
            ) : phase === 'probing' || phase === 'rebooting' ? (
              <Badge variant="warning" className="gap-1.5 text-xs">
                <LoaderCircleIcon className="size-3 animate-spin" />
                <span>Restarting...</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {server.status}
              </Badge>
            )}
          </div>
        </div>

        <Card className="border-border/60 bg-card shadow-2xs">
          <CardContent className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            {phase === 'online' ? (
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2Icon className="size-5" />
              </div>
            ) : phase === 'probing' || phase === 'rebooting' ? (
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LoaderCircleIcon className="size-5 animate-spin" />
              </div>
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <RefreshCwIcon className="size-5" />
              </div>
            )}

            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                {phase === 'online'
                  ? 'Server is back online'
                  : phase === 'probing' || phase === 'rebooting'
                  ? 'Restarting server...'
                  : 'Restart server'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {phase === 'online'
                  ? uptime
                    ? `System is responsive (${uptime}).`
                    : 'SSH connection re-established.'
                  : phase === 'probing' || phase === 'rebooting'
                  ? probeAttempt > 0
                    ? `Reconnecting (attempt #${probeAttempt})...`
                    : 'Waiting for server to reconnect...'
                  : 'Reboot the system and reload all running services.'}
              </p>
            </div>

            {phase === 'online' ? (
              <div className="flex items-center gap-2 pt-1">
                <Button asChild size="sm" className="h-7.5 text-xs cursor-pointer">
                  <Link href={route('servers.show', { server: server.id })}>
                    Return to overview
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={triggerReboot} className="h-7.5 text-xs cursor-pointer">
                  Restart again
                </Button>
              </div>
            ) : phase === 'idle' ? (
              <Button size="sm" onClick={triggerReboot} className="gap-1.5 cursor-pointer h-7.5 text-xs">
                <PowerIcon className="size-3.5" />
                <span>Restart server</span>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {milestones.length > 0 && (
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer py-1"
            >
              <TerminalIcon className="size-3" />
              <span>{showDetails ? 'Hide details' : 'Show details'}</span>
            </button>

            {showDetails && (
              <div className="w-full mt-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-[11px] font-mono text-muted-foreground space-y-1">
                {milestones.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <span className="text-muted-foreground/60 select-none shrink-0">{m.time}</span>
                    <span className="text-foreground">{m.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Container>
    </ServerLayout>
  );
}
