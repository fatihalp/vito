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
  const name = isSelf ? 'Vito sunucusu' : String(value || row.name || '');

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/servers/${id}`}
        className={cn('font-medium hover:underline', isSelf && 'text-primary font-semibold')}
      >
        {name}
      </Link>
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

const phpVersionsCell = ({ value, row }: CellRenderProps) => {
  const result = value as PhpVersions | null;

  if (!result) {
    return <span className="text-muted-foreground text-xs">Kontrol edilmedi</span>;
  }

  const labels = {
    unknown: 'Kontrol edilmedi',
    current: 'Güncel',
    outdated: 'Güncel değil',
    error: 'Kontrol başarısız',
    no_php: 'PHP yok',
  };
  const stale = result.checked_at !== null && Date.now() - Date.parse(result.checked_at) > 3_600_000;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={`/servers/${row.id}/services`} className="inline-flex flex-col items-start gap-1">
          <Badge variant={result.status === 'outdated' ? 'warning' : result.status === 'current' ? 'success' : 'gray'}>
            {result.checking && <LoaderCircleIcon className="size-3 animate-spin" />}
            {result.checking ? 'Kontrol ediliyor' : labels[result.status]}
          </Badge>
          {result.versions.map((version) => (
            <span key={version.installed} className="text-muted-foreground whitespace-nowrap text-xs">
              {version.installed}{version.outdated ? ` → ${version.latest}` : ''}{version.unsupported ? ' · Destek sona erdi' : ''}
            </span>
          ))}
          {stale && <span className="text-muted-foreground text-xs">Önbellekteki sonuç</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>Her PHP dalının en son yama sürümüyle karşılaştırılır.</p>
        <p>{result.checked_at ? `Son başarılı kontrol: ${new Date(result.checked_at).toLocaleString()}` : 'Henüz başarılı bir kontrol yapılmadı.'}</p>
        {result.status === 'error' && <p>Sunucuya veya PHP sürüm kaynağına erişilemedi. Önceki sonuç korunuyor.</p>}
      </TooltipContent>
    </Tooltip>
  );
};

export default function Servers() {
  const page = usePage<Page & SharedData>();
  const versionForm = useForm({ project: page.props.serverScope ?? 'all' });
  const checkingVersions = page.props.phpVersionsChecking || versionForm.processing;

  useEffect(() => {
    if (!page.props.phpVersionsChecking) return;
    const interval = window.setInterval(() => router.reload({ only: ['servers', 'phpVersionsChecking'] }), 5000);
    return () => window.clearInterval(interval);
  }, [page.props.phpVersionsChecking]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['servers', 'phpVersionsChecking'] });
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <Layout>
      <Head title="Servers" />

      <Container className="max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Heading title="Servers" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={checkingVersions}
              onClick={() => {
                versionForm.transform(() => ({ project: page.props.serverScope ?? 'all' }));
                versionForm.post('/servers/check-php-versions', { preserveScroll: true });
              }}
            >
              <RefreshCwIcon className={cn(checkingVersions && 'animate-spin')} />
              Sürümleri kontrol et
            </Button>
            <Button asChild>
              <Link href={"/servers/create"}>
                <PlusIcon />
                Create server
              </Link>
            </Button>
          </div>
        </div>
        <VitoTable
          tableData={page.props.servers}
          groupBy={page.props.groupBy}
          rowClassName={(row: Row) => {
            if (row.is_self) {
              return 'bg-primary/5 hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15 border-b-primary/30';
            }
            return '';
          }}
          toolbar={
            <div className="flex flex-wrap items-center gap-3">
              <Select
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
                <SelectTrigger className="w-56" aria-label="PHP güncellik filtresi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm PHP durumları</SelectItem>
                  <SelectItem value="outdated">PHP güncel olmayanlar</SelectItem>
                </SelectContent>
              </Select>
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
            name: nameCell,
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
