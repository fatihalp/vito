import { usePanelView } from '@/hooks/use-panel-view';
import PanelViewToggle from '@/components/panel-view-toggle';
import { useSocketStore } from '@/stores/socket-store';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';

import { type Configs, type SharedData } from '@/types';

import { asRow } from '@/lib/inertia-table';
import { VitoTable } from '@/components/vito-table';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/layouts/app/layout';
import { PlusIcon, TriangleAlertIcon, GlobeIcon, DatabaseIcon, ZapIcon, ListOrderedIcon, ServerIcon, WifiOffIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect } from 'react';
import type { PhpVersions } from '@/types/php-versions';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Page = {
  servers: InertiaTableData;
  phpVersionsChecking: boolean;
  phpStatus: 'all' | 'outdated';
  public_key: string;
  configs: Configs;
  serverScope?: string;
  groupBy?: 'none' | 'project';
};

const nameCell = ({ row, value }: CellRenderProps) => {
  const status = String(row.status || '');
  const isUnreachable = status === 'disconnected' || row.is_disconnected === true;
  const isInstalling = status === 'installing';
  const isFailed = status === 'installation_failed';
  const isSelf = Boolean(row.is_self);
  const id = row.id as number;
  const name = isSelf ? 'Pure server' : String(value || row.name || '');
  const sitesCount = typeof row.sites_count === 'number' ? row.sites_count : 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/servers/${id}`}
          className={cn('font-medium hover:underline', isSelf && 'text-primary font-semibold')}
        >
          {name}
        </Link>
        <span className="text-muted-foreground text-xs font-normal">({sitesCount})</span>
      </div>
      {isUnreachable && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                <WifiOffIcon className="size-3 shrink-0" />
                Unreachable
              </span>
            </TooltipTrigger>
            <TooltipContent>Server connection lost / unreachable</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {isInstalling && (
        <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
          <LoaderCircleIcon className="size-3 animate-spin shrink-0" />
          Installing
        </span>
      )}
      {isFailed && (
        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
          Failed
        </span>
      )}
    </div>
  );
};

const metricCell = (threshold: number) =>
  function MetricCell({ value, row }: CellRenderProps) {
    const isUnreachable = row.status === 'disconnected' || row.is_disconnected === true;

    if (isUnreachable) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground inline-flex cursor-default items-center gap-1 text-xs">
                <WifiOffIcon className="size-3.5 text-muted-foreground/70 shrink-0" />
                <span>—</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Server unreachable</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const numeric = typeof value === 'number' ? value : null;

    if (numeric === null) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }

    return (
      <span className={cn('font-mono text-sm', numeric > threshold ? 'font-semibold text-neutral-500' : 'text-foreground')}>
        {numeric.toFixed(1)}%
      </span>
    );
  };

const cpuCell = metricCell(80);
const ramCell = metricCell(85);
const diskCell = metricCell(90);

const coresCell = ({ value }: CellRenderProps) => {
  const cores = typeof value === 'number' && value > 0 ? value : null;

  if (cores === null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return <span className="font-mono text-sm">{cores} vCPU</span>;
};

type ServerCost = {
  amount: number;
  currency: string;
  formatted: string;
  plan: string;
  region: string | null;
};

const costCell = ({ value }: CellRenderProps) => {
  const cost = (value as ServerCost | null) ?? null;

  if (!cost || !cost.formatted) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-col">
      <span className="font-mono text-sm font-medium">{cost.formatted}</span>
      {cost.plan && (
        <span className="text-muted-foreground text-[11px]">
          {cost.plan}{cost.region ? ` · ${cost.region}` : ''}
        </span>
      )}
    </div>
  );
};

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
    <div className="flex flex-wrap items-center gap-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium">{displayText}</span>
    </div>
  );
};

const stageCell = ({ value }: CellRenderProps) => {
  const stage = String(value || 'prod').toLowerCase();

  let dotColor = 'bg-neutral-400 dark:bg-neutral-500';
  let textColor = 'text-neutral-700 dark:text-neutral-300';
  let bgClass = 'bg-neutral-500/5 dark:bg-neutral-500/10 border-neutral-500/15';

  if (stage === 'beta') {
    dotColor = 'bg-neutral-400 dark:bg-neutral-500';
    textColor = 'text-neutral-700 dark:text-neutral-300';
    bgClass = 'bg-neutral-500/5 dark:bg-neutral-500/10 border-neutral-500/15';
  } else if (stage === 'alfa') {
    dotColor = 'bg-neutral-400 dark:bg-neutral-500';
    textColor = 'text-neutral-700 dark:text-neutral-300';
    bgClass = 'bg-neutral-500/5 dark:bg-neutral-500/10 border-neutral-500/15';
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider', bgClass, textColor)}>
      <span className={cn('size-1.5 rounded-full', dotColor)} />
      {stage}
    </span>
  );
};

const warningsCell = ({ row, value }: CellRenderProps) => {
  const isUnreachable = row.status === 'disconnected' || row.is_disconnected === true;

  if (isUnreachable) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const warnings = ((value as Array<{ key: string; count?: number }>) ?? (row.warnings as Array<{ key: string; count?: number }>)) || [];
  const count = warnings.length;

  if (count === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const formatWarningLabel = (w: { key: string; count?: number }) => {
    if (w.key === 'reboot_required') return 'Restart required';
    if (w.key === 'updates_available') return `${w.count ?? ''} package ${w.count === 1 ? 'update' : 'updates'} available`;
    if (w.key === 'kernel_update_available') return 'Kernel update available';
    if (w.key === 'backups_need_attention') return `${w.count} ${w.count === 1 ? 'backup needs' : 'backups need'} attention`;
    return w.key;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-1.5 text-warning/80 hover:text-warning"
          aria-label={`${count} server ${count === 1 ? 'warning' : 'warnings'}`}
          onClick={(event) => event.stopPropagation()}
        >
          <TriangleAlertIcon className="size-3.5" />
          <span className="text-xs tabular-nums">{count}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3" onClick={(event) => event.stopPropagation()}>
        <p className="mb-2 text-xs font-medium">Server warnings</p>
        <ul className="text-muted-foreground flex flex-col gap-2 text-xs">
          {warnings.map((warning) => <li key={warning.key}>{formatWarningLabel(warning)}</li>)}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const phpVersionsCell = ({ value, row }: CellRenderProps) => {
  const result = value as PhpVersions | null;

  if (!result) {
    return <span className="text-muted-foreground text-xs">Not checked</span>;
  }

  const labels = {
    unknown: 'Not checked',
    current: 'Up to date',
    outdated: 'Outdated',
    error: 'Check failed',
    no_php: 'No PHP',
  };
  const stale = result.checked_at !== null && Date.now() - Date.parse(result.checked_at) > 3_600_000;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/servers/${row.id}/services`} className="inline-flex flex-col items-start gap-1">
          <Badge variant={result.status === 'outdated' ? 'warning' : result.status === 'current' ? 'success' : 'gray'}>
            {result.checking && <LoaderCircleIcon className="size-3 animate-spin" />}
            {result.checking ? 'Checking' : labels[result.status]}
          </Badge>
          {result.versions.map((version) => (
            <span key={version.installed} className="text-muted-foreground whitespace-nowrap text-xs">
              {version.installed}{version.outdated ? ` → ${version.latest}` : ''}{version.unsupported ? ' · End of support' : ''}
            </span>
          ))}
          {stale && <span className="text-muted-foreground text-xs">Cached result</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>Compared with the latest patch release for each PHP branch.</p>
        <p>{result.checked_at ? `Last successful check: ${new Date(result.checked_at).toLocaleString('en-US')}` : 'No successful checks yet.'}</p>
        {result.status === 'error' && <p>Unable to reach the server or PHP version source. Previous results are preserved.</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default function Servers() {
  const page = usePage<Page & SharedData>();
  const versionForm = useForm({ project: page.props.serverScope ?? 'all' });
  const { advanced } = usePanelView();
  const checkingVersions = page.props.phpVersionsChecking || versionForm.processing;

  const socketStatus = useSocketStore((s) => s.status);

  useEffect(() => {
    if (socketStatus === 'connected') return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['servers', 'phpVersionsChecking'] });
      }
    }, page.props.phpVersionsChecking ? 5000 : 60_000);

    return () => window.clearInterval(interval);
  }, [socketStatus, page.props.phpVersionsChecking]);

  return (
    <Layout>
      <Head title="Servers" />

      <Container>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Heading title="Servers" />
          <div className="flex flex-wrap items-center gap-2">
            {advanced && <Button
              variant="outline"
              disabled={checkingVersions}
              onClick={() => {
                versionForm.transform(() => ({ project: page.props.serverScope ?? 'all' }));
                versionForm.post('/servers/check-php-versions', { preserveScroll: true });
              }}
            >
              <RefreshCwIcon className={cn(checkingVersions && 'animate-spin')} />
              Check versions
            </Button>}
            <Button asChild>
              <Link href={"/servers/create"}>
                <PlusIcon />
                Create server
              </Link>
            </Button>
          </div>
        </div>
        <VitoTable
          fitContent
          toolbarClassName="[&_input]:h-8 [&_input]:max-w-56"
          columnWidths={advanced ? { name: '30%', monthly_cost: '18%', php_versions: '16%', cpu_usage_percent: '12%', memory_used_percent: '12%', disk_used_percent: '12%' } : { name: '65%', ip: '35%' }}
          tableData={{ ...page.props.servers, columns: page.props.servers.columns.filter((column) => column.hidden || (advanced
            ? ['name', 'monthly_cost', 'php_versions', 'cpu_usage_percent', 'memory_used_percent', 'disk_used_percent']
            : ['name', 'ip']).includes(column.name)).map((column) => ({ ...column, fit: false })) }}
          groupBy={page.props.groupBy}
          rowClassName={(row: Row) => {
            if (row.is_self) {
              return 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15 border-b-primary/30';
            }
            return '';
          }}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <PanelViewToggle label="Server view" />
              {advanced && <Select
                value={page.props.phpStatus ?? 'all'}
                onValueChange={(status) => {
                  const url = new URL(window.location.href);
                  if (status === 'all') {
                    url.searchParams.delete('php_status');
                  } else {
                    url.searchParams.set('php_status', status);
                  }
                  url.searchParams.delete('page');
                  router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                }}
              >
                <SelectTrigger className="h-8 w-44" aria-label="PHP version status filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All PHP statuses</SelectItem>
                  <SelectItem value="outdated">Outdated PHP</SelectItem>
                </SelectContent>
              </Select>}
              <div className="flex flex-wrap items-center gap-2">
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
                  <SelectTrigger className="h-8 w-40" aria-label="Group servers by">
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
            name: (props: CellRenderProps) => (
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {nameCell(props)}
                  {Array.isArray(props.row.warnings) && props.row.warnings.length > 0 && warningsCell({ ...props, value: props.row.warnings })}
                </div>
                {advanced && <span className="font-mono text-xs text-muted-foreground">{String(props.row.ip ?? '')}</span>}
                {advanced && <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {roleCell({ ...props, value: props.row.role })}
                  {stageCell({ ...props, value: props.row.stage })}
                </div>}
              </div>
            ),
            cpu_cores: coresCell,
            monthly_cost: (props: CellRenderProps) => <div className="flex flex-col gap-1">{costCell(props)}{coresCell({ ...props, value: props.row.cpu_cores })}</div>,
            php_versions: phpVersionsCell,
            cpu_usage_percent: cpuCell,
            memory_used_percent: ramCell,
            disk_used_percent: diskCell,
            role: roleCell,
            stage: stageCell,
            warnings: warningsCell,
          }}
          onRowClick={(row: Row) => {
            const server = asRow<{ id: number }>(row, ['id']);
            router.visit(`/servers/${server.id}`);
          }}
        />
      </Container>
    </Layout>
  );
}
