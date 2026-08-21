import { Head, Link, router, usePage } from '@inertiajs/react';

import { type Configs } from '@/types';

import { VitoTable } from '@/components/vito-table';
import Heading from '@/components/heading';
import CreateServer from '@/pages/servers/components/create-server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import Layout from '@/layouts/app/layout';
import { BookOpenIcon, EyeIcon, PlusIcon, TriangleAlertIcon, GlobeIcon, DatabaseIcon, ZapIcon, ListOrderedIcon } from 'lucide-react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

type Page = {
  servers: InertiaTableData;
  public_key: string;
  configs: Configs;
};

const performanceCell = ({ row, value }: CellRenderProps) => {
  const performance = row.performance as { label: string; color: 'gray' | 'success' | 'info' | 'warning' | 'danger'; stale: boolean } | undefined;

  if (value === null || value === undefined || !performance) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  if (performance.stale) {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-amber-500" />
        <span className="text-muted-foreground font-mono text-xs">Stale (5m+)</span>
      </div>
    );
  }

  const cpu = typeof row.cpu_usage_percent === 'number' ? row.cpu_usage_percent : null;
  const ram = typeof row.memory_used_percent === 'number' ? row.memory_used_percent : null;
  const disk = typeof row.disk_used_percent === 'number' ? row.disk_used_percent : null;

  return (
    <div className="flex items-center gap-3 font-mono text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-[11px]">CPU</span>
        <span className={cn('font-medium', cpu !== null && cpu > 80 ? 'font-semibold text-rose-500' : 'text-foreground')}>
          {cpu !== null ? `${cpu.toFixed(1)}%` : '—'}
        </span>
      </div>
      <span className="text-muted-foreground/30">•</span>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-[11px]">RAM</span>
        <span className={cn('font-medium', ram !== null && ram > 85 ? 'font-semibold text-rose-500' : 'text-foreground')}>
          {ram !== null ? `${ram.toFixed(1)}%` : '—'}
        </span>
      </div>
      <span className="text-muted-foreground/30">•</span>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-[11px]">Disk</span>
        <span className={cn('font-medium', disk !== null && disk > 90 ? 'font-semibold text-rose-500' : 'text-foreground')}>
          {disk !== null ? `${disk.toFixed(1)}%` : '—'}
        </span>
      </div>
    </div>
  );
};

const getRoleIcon = (roleValue: unknown, roleLabel: unknown) => {
  const str = `${String(roleValue || '')} ${String(roleLabel || '')}`.toLowerCase();

  if (str.includes('cache') || str.includes('redis')) {
    return ZapIcon;
  }

  if (str.includes('data') || str.includes('db') || str.includes('postgres') || str.includes('mysql')) {
    return DatabaseIcon;
  }

  if (str.includes('queue') || str.includes('worker') || str.includes('horizon')) {
    return ListOrderedIcon;
  }

  return GlobeIcon;
};

const roleCell = ({ row, value }: CellRenderProps) => {
  const Icon = getRoleIcon(row.role_value, value ?? row.role);
  const displayText = String(value || row.role || 'App server');

  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium">{displayText}</span>
    </div>
  );
};

const stageCell = ({ value }: CellRenderProps) => {
  const stage = String(value || 'prod').toLowerCase();

  let dotColor = 'bg-rose-400 dark:bg-rose-500';
  let textColor = 'text-rose-700 dark:text-rose-300';
  let bgClass = 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/15';

  if (stage === 'beta') {
    dotColor = 'bg-sky-400 dark:bg-sky-500';
    textColor = 'text-sky-700 dark:text-sky-300';
    bgClass = 'bg-sky-500/5 dark:bg-sky-500/10 border-sky-500/15';
  } else if (stage === 'alfa') {
    dotColor = 'bg-emerald-400 dark:bg-emerald-500';
    textColor = 'text-emerald-700 dark:text-emerald-300';
    bgClass = 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/15';
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider', bgClass, textColor)}>
      <span className={cn('size-1.5 rounded-full', dotColor)} />
      {stage}
    </span>
  );
};

export default function Servers() {
  const page = usePage<Page>();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['servers'] });
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <Layout>
      <Head title="Servers" />

      <Container className="max-w-7xl">
        <div className="flex items-start justify-between">
          <Heading title="Servers" />
          <div className="flex items-center gap-2">
            <CreateServer>
              <Button>
                <PlusIcon />
                Create server
              </Button>
            </CreateServer>
          </div>
        </div>
        <VitoTable
          tableData={page.props.servers}
          cellRenderers={{ performance_score: performanceCell, role: roleCell, stage: stageCell }}
          actions={(row: Row) => {
            const warnings = (row.warnings as Array<{ key: string }>) ?? [];
            const count = warnings.length;
            return (
              <div className="flex items-center justify-end gap-2">
                {count > 0 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-warning/15 text-warning border-warning/40 flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1.5">
                          <TriangleAlertIcon className="h-4 w-4" />
                          <span className="text-xs font-semibold">{count}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {count} {count === 1 ? 'warning' : 'warnings'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Link href={route('servers.show', { server: row.id })} prefetch>
                  <Button variant="outline" size="sm">
                    <EyeIcon />
                  </Button>
                </Link>
              </div>
            );
          }}
        />
      </Container>
    </Layout>
  );
}
