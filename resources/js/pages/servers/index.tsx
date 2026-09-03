import { Head, router, usePage } from '@inertiajs/react';

import { type Configs, type SharedData } from '@/types';

import { asRow } from '@/lib/inertia-table';
import { VitoTable } from '@/components/vito-table';
import Heading from '@/components/heading';
import CreateServer from '@/pages/servers/components/create-server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/layouts/app/layout';
import { PlusIcon, TriangleAlertIcon, GlobeIcon, DatabaseIcon, ZapIcon, ListOrderedIcon, ServerIcon } from 'lucide-react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

type Page = {
  servers: InertiaTableData;
  public_key: string;
  configs: Configs;
  serverScope?: string;
  groupBy?: 'none' | 'project';
};

const metricCell = (threshold: number) =>
  function MetricCell({ value }: CellRenderProps) {
    const numeric = typeof value === 'number' ? value : null;

    if (numeric === null) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    return (
      <span className={cn('font-mono text-sm', numeric > threshold ? 'font-semibold text-rose-500' : 'text-foreground')}>
        {numeric.toFixed(1)}%
      </span>
    );
  };

const cpuCell = metricCell(80);
const ramCell = metricCell(85);
const diskCell = metricCell(90);

const getRoleIcon = (roleValue: unknown, roleLabel: unknown) => {
  const str = `${String(roleValue || '')} ${String(roleLabel || '')}`.toLowerCase();

  if (str.includes('custom')) {
    return ServerIcon;
  }

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

const warningsCell = ({ row, value }: CellRenderProps) => {
  const warnings = ((value as Array<{ key: string; count?: number }>) ?? (row.warnings as Array<{ key: string; count?: number }>)) || [];
  const count = warnings.length;

  if (count === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const formatWarningLabel = (w: { key: string; count?: number }) => {
    if (w.key === 'reboot_required') return 'Restart required';
    if (w.key === 'updates_available') return `${w.count ?? ''} package ${w.count === 1 ? 'update' : 'updates'} available`;
    if (w.key === 'kernel_update_available') return 'Kernel update available';
    return w.key;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="bg-warning/15 text-warning border-warning/40 inline-flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1">
            <TriangleAlertIcon className="size-3.5 shrink-0" />
            <span className="text-xs font-semibold">{count} {count === 1 ? 'warning' : 'warnings'}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 p-2">
          {warnings.map((warning, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>{formatWarningLabel(warning)}</span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function Servers() {
  const page = usePage<Page & SharedData>();

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
          groupBy={page.props.groupBy}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Project</span>
                <Select
                  value={page.props.serverScope ?? 'all'}
                  onValueChange={(project) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set('project', project);
                    url.searchParams.delete('page');
                    router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                  }}
                >
                  <SelectTrigger className="w-40 sm:w-48" aria-label="Filter servers by project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {(page.props.auth.user.projects ?? []).map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Group by</span>
                <Select
                  value={page.props.groupBy ?? 'none'}
                  onValueChange={(groupBy) => {
                    const url = new URL(window.location.href);
                    if (groupBy === 'none') {
                      url.searchParams.delete('group_by');
                    } else {
                      url.searchParams.set('group_by', groupBy);
                    }
                    url.searchParams.delete('page');
                    router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                  }}
                >
                  <SelectTrigger className="w-40 sm:w-48" aria-label="Group servers by">
                    <SelectValue placeholder="No grouping" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No grouping</SelectItem>
                    <SelectItem value="project">Group by Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          cellRenderers={{
            cpu_usage_percent: cpuCell,
            memory_used_percent: ramCell,
            disk_used_percent: diskCell,
            role: roleCell,
            stage: stageCell,
            warnings: warningsCell,
          }}
          onRowClick={(row: Row) => {
            const server = asRow<{ id: number }>(row, ['id']);
            router.visit(route('servers.show', { server: server.id }));
          }}
        />
      </Container>
    </Layout>
  );
}
