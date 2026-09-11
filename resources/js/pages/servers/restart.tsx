import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  CheckIcon,
  LoaderCircleIcon,
  PowerIcon,
  RefreshCwIcon,
  ServerIcon,
  TerminalIcon,
  Trash2Icon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useClipboard } from '@/hooks/use-clipboard';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { cn } from '@/lib/utils';

type PageProps = {
  server: Server;
};

type RestartPhase = 'idle' | 'rebooting' | 'probing' | 'online' | 'failed';

type LogEntry = {
  id: string;
  time: string;
  type: 'init' | 'exec' | 'remote' | 'ssh' | 'poll' | 'success' | 'error' | 'info';
  message: string;
};

export default function ServerRestart() {
  const { server: initialServer } = usePage<PageProps>().props;
  const server = useRealtimeRecord<Server>(initialServer, 'server') ?? initialServer;

  const [phase, setPhase] = useState<RestartPhase>(
    server.status === 'disconnected' ? 'probing' : 'idle'
  );
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const initialLogs: LogEntry[] = [];
    const now = new Date().toLocaleTimeString();
    if (server.status === 'disconnected') {
      initialLogs.push({
        id: 'init-0',
        time: now,
        type: 'info',
        message: `Server ${server.name} (${server.ip}) is currently disconnected. Automatic reconnection active.`,
      });
    } else {
      initialLogs.push({
        id: 'init-0',
        time: now,
        type: 'info',
        message: `Ready to reboot ${server.name} (${server.ip}:${server.port}).`,
      });
    }
    return initialLogs;
  });

  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);
  const [probeAttempt, setProbeAttempt] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(3);
  const [uptime, setUptime] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const autoReconnectRef = useRef<boolean>(autoReconnect);
  autoReconnectRef.current = autoReconnect;

  const { copied, copy } = useClipboard();

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        time,
        type,
        message,
      },
    ]);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

      if (!response.ok) {
        addLog('poll', `Probe failed with HTTP ${response.status}. Retrying...`);
        return false;
      }

      const data = await response.json();

      if (data.online) {
        setUptime(data.uptime ?? null);
        addLog('success', data.message || 'SSH connection established!');
        if (data.uptime) {
          addLog('info', `Server uptime: ${data.uptime}`);
        }
        addLog('success', 'Server is fully online and ready!');
        setPhase('online');
        return true;
      }

      addLog('poll', `[Attempt #${probeAttempt + 1}] ${data.message || 'Waiting for server...'}`);
      return false;
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Network error';
      addLog('poll', `[Attempt #${probeAttempt + 1}] Connection attempt error: ${err}`);
      return false;
    }
  }, [addLog, probeAttempt, server.id]);

  const triggerReboot = useCallback(async () => {
    setPhase('rebooting');
    setProbeAttempt(0);
    setUptime(null);

    addLog('init', `Initiating reboot command on ${server.name}...`);
    addLog('ssh', `Connecting to ${server.ip}:${server.port} via SSH...`);
    addLog('exec', '$ sudo reboot');

    try {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
      const response = await fetch(route('servers.restart.trigger', { server: server.id }), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.logs)) {
          data.logs.forEach((logLine: string) => {
            if (logLine.includes('$ sudo reboot')) {
              return;
            } else if (logLine.includes('Rebooting... Bye!')) {
              addLog('remote', 'Rebooting... Bye!');
            } else if (logLine.includes('Connection closed')) {
              addLog('ssh', 'Connection closed by remote host (Server is rebooting).');
            } else {
              addLog('info', logLine.replace(/^\[\d+:\d+:\d+\]\s*/, ''));
            }
          });
        }
      } else {
        addLog('remote', 'Rebooting... Bye!');
        addLog('ssh', 'Connection closed by remote host.');
      }
    } catch {
      addLog('remote', 'Rebooting... Bye!');
      addLog('ssh', 'Connection closed by remote host.');
    }

    addLog('info', 'Reboot signal sent. Waiting for operating system to power cycle...');
    setPhase('probing');
  }, [addLog, server.id, server.ip, server.name, server.port]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('start') === '1' || params.get('auto') === '1') {
      window.history.replaceState(null, '', window.location.pathname);
      triggerReboot();
    }
  }, [triggerReboot]);

  useEffect(() => {
    if (phase !== 'probing' || !autoReconnect) {
      return;
    }

    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;

    setCountdown(3);

    countdownInterval = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 3));
    }, 1000);

    const runProbe = async () => {
      setProbeAttempt((c) => c + 1);
      const isOnline = await probeConnection();
      if (isOnline || !isMounted || !autoReconnectRef.current) {
        return;
      }
      setCountdown(3);
      timer = setTimeout(runProbe, 3000);
    };

    timer = setTimeout(runProbe, 2000);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [phase, autoReconnect, probeConnection]);

  const handleManualProbe = async () => {
    if (phase === 'rebooting') return;
    setProbeAttempt((c) => c + 1);
    await probeConnection();
  };

  const copyAllLogs = () => {
    const text = logs.map((l) => `[${l.time}] ${l.message}`).join('\n');
    copy(text);
  };

  const clearLogs = () => {
    setLogs([
      {
        id: `${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'Console logs cleared.',
      },
    ]);
  };

  return (
    <ServerLayout>
      <Head title={`Restart Server - ${server.name}`} />

      <Container className="max-w-5xl space-y-3.5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 cursor-pointer">
              <Link href={route('servers.show', { server: server.id })}>
                <ArrowLeftIcon className="size-3.5" />
                <span>Server</span>
              </Link>
            </Button>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <ServerIcon className="size-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold text-foreground tracking-tight">
                {server.name}
              </h1>
              <span className="font-mono text-xs text-muted-foreground">({server.ip})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'online' ? (
              <Badge variant="success" className="gap-1.5 px-2.5 py-1 text-xs">
                <CheckCircle2Icon className="size-3.5" />
                Online &amp; Ready
              </Badge>
            ) : phase === 'probing' ? (
              <Badge variant="warning" className="gap-1.5 px-2.5 py-1 text-xs animate-pulse">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Reconnecting (Attempt #{probeAttempt})
              </Badge>
            ) : phase === 'rebooting' ? (
              <Badge variant="warning" className="gap-1.5 px-2.5 py-1 text-xs">
                <LoaderCircleIcon className="size-3.5 animate-spin" />
                Sending Reboot Signal...
              </Badge>
            ) : server.status === 'disconnected' ? (
              <Badge variant="gray" className="gap-1.5 px-2.5 py-1 text-xs">
                <WifiOffIcon className="size-3.5" />
                Disconnected
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1.5 px-2.5 py-1 text-xs">
                <WifiIcon className="size-3.5" />
                {server.status}
              </Badge>
            )}

            {phase === 'online' && (
              <Button size="sm" asChild className="h-8 gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link href={route('servers.show', { server: server.id })}>
                  <CheckCircle2Icon className="size-3.5" />
                  <span>Return to Overview</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {phase === 'online' && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold text-sm">Server reboot completed successfully!</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  SSH connection re-established and system is ready. {uptime && `(${uptime})`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs cursor-pointer border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/20"
                onClick={triggerReboot}
              >
                <RefreshCwIcon className="size-3 mr-1.5" />
                Reboot Again
              </Button>
              <Button size="sm" asChild className="h-7 text-xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white">
                <Link href={route('servers.show', { server: server.id })}>
                  Server Overview
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/50 bg-card px-3.5 py-2 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              disabled={phase === 'rebooting'}
              onClick={triggerReboot}
              className={cn(
                'h-7.5 text-xs gap-1.5 cursor-pointer font-medium',
                phase === 'rebooting' && 'opacity-60 cursor-not-allowed'
              )}
            >
              {phase === 'rebooting' ? (
                <>
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  <span>Rebooting...</span>
                </>
              ) : (
                <>
                  <PowerIcon className="size-3.5" />
                  <span>{phase === 'online' ? 'Reboot Server Again' : 'Start Server Reboot'}</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={phase === 'rebooting'}
              onClick={handleManualProbe}
              className="h-7.5 text-xs gap-1.5 cursor-pointer"
            >
              <RefreshCwIcon className="size-3" />
              <span>Probe Connection</span>
            </Button>

            <div className="h-4 w-px bg-border/60 hidden sm:block" />

            <div className="flex items-center gap-2">
              <Switch
                id="auto-reconnect"
                checked={autoReconnect}
                onCheckedChange={setAutoReconnect}
              />
              <Label htmlFor="auto-reconnect" className="text-xs cursor-pointer font-normal text-muted-foreground">
                Auto-reconnect
              </Label>
              {phase === 'probing' && autoReconnect && (
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  (next probe in {countdown}s)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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

        <div className="overflow-hidden rounded-lg border border-border/60 bg-neutral-950 text-neutral-100 shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-3.5 py-2 select-none">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 rounded-full bg-red-500/80" />
                <div className="size-2.5 rounded-full bg-yellow-500/80" />
                <div className="size-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className="font-mono text-[11px] text-neutral-400 ml-2">
                terminal — {server.ssh_user || 'root'}@{server.ip}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
              <TerminalIcon className="size-3.5 text-neutral-500" />
              <span>bash</span>
            </div>
          </div>

          <div className="h-[420px] overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-1">
            {logs.map((log) => {
              let badgeColor = 'text-neutral-400';
              if (log.type === 'exec') badgeColor = 'text-emerald-400 font-bold';
              if (log.type === 'remote') badgeColor = 'text-cyan-300 font-semibold';
              if (log.type === 'ssh') badgeColor = 'text-sky-400';
              if (log.type === 'poll') badgeColor = 'text-amber-400';
              if (log.type === 'success') badgeColor = 'text-emerald-400 font-bold';
              if (log.type === 'error') badgeColor = 'text-rose-400 font-semibold';
              if (log.type === 'info') badgeColor = 'text-neutral-400';

              return (
                <div key={log.id} className="flex items-start gap-2.5 hover:bg-neutral-900/40 px-1 py-0.5 rounded transition-colors">
                  <span className="text-neutral-500 select-none shrink-0 text-[11px]">
                    {log.time}
                  </span>
                  <span className={cn('break-all', badgeColor)}>
                    {log.type === 'exec' ? log.message : log.message}
                  </span>
                </div>
              );
            })}

            {phase === 'probing' && (
              <div className="flex items-center gap-2 text-amber-400/90 pt-1 text-xs">
                <LoaderCircleIcon className="size-3.5 animate-spin shrink-0" />
                <span>Probing server connection... Attempt #{probeAttempt + 1} (checking every 3s)</span>
              </div>
            )}

            {phase === 'rebooting' && (
              <div className="flex items-center gap-2 text-sky-400/90 pt-1 text-xs">
                <LoaderCircleIcon className="size-3.5 animate-spin shrink-0" />
                <span>Executing reboot command on server...</span>
              </div>
            )}

            <div ref={terminalEndRef} />
          </div>
        </div>
      </Container>
    </ServerLayout>
  );
}
