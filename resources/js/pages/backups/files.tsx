import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ServerLayout from '@/layouts/server/layout';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  CloudUploadIcon,
  DatabaseIcon,
  FileTextIcon,
  HardDriveIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  RotateCcwIcon,
  SearchIcon,
  XCircleIcon,
} from 'lucide-react';
import { Backup } from '@/types/backup';
import { DataTable } from '@/components/data-table';
import { PaginatedData } from '@/types';
import { BackupFile } from '@/types/backup-file';
import { columns } from '@/pages/backups/components/file-columns';
import CopyableBadge from '@/components/copyable-badge';
import ErrorIndicator from '@/components/error-indicator';
import DateTime from '@/components/date-time';
import { useRealtime } from '@/hooks/use-socket-events';
import { useDialog } from '@/hooks/use-dialog';
import { useConfigs } from '@/stores/bootstrap-store';
import BackupHealthAlerts from '@/pages/backups/components/backup-health-alerts';
import { BackupMenuItems } from '@/pages/backups/components/backup-actions';
import RelativeDate from '@/pages/backups/components/relative-date';
import { BackupRestore } from '@/types/backup-restore';
import { formatBytes } from '@/lib/utils';

type Page = {
  server: Server;
  backup: Backup;
  files: PaginatedData<BackupFile>;
  hasNotificationChannels: boolean;
  restores: BackupRestore[];
};

function CheckStatusPill({ label, result, checkedAt }: { label: string; result: 'passed' | 'failed' | null; checkedAt: string | null }) {
  const Icon = result === 'passed' ? CheckCircle2Icon : result === 'failed' ? XCircleIcon : ClockIcon;
  const color = result === 'passed' ? 'text-success' : result === 'failed' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <span className="bg-muted/50 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
          <Icon className={`size-3.5 ${color}`} />
          <span>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs">
        {label}: {result ?? 'not run yet'}
        {checkedAt && (
          <>
            {' · '}
            <DateTime date={checkedAt} relative />
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function RestoreTargetLabel({ restore }: { restore: BackupRestore }) {
  if (restore.target === 'backup') {
    return <span className="font-mono text-xs">{restore.backup_file_name ?? 'backup'}</span>;
  }

  if (restore.target === 'time' && restore.target_time) {
    return (
      <span className="text-xs">
        Point in time · <DateTime date={restore.target_time} />
      </span>
    );
  }

  return <span className="text-xs">Latest</span>;
}

export default function Files() {
  const page = usePage<Page>();
  const configs = useConfigs();
  const dialog = useDialog();
  const [databaseFilter, setDatabaseFilter] = useState('');
  const [files] = useRealtime<BackupFile>(page.props.files, 'backup-file', { backup_id: page.props.backup.id });

  const { backup, server, restores } = page.props;
  const isPgBackRest = backup.type === 'pgbackrest';
  const databases = useMemo(() => backup.databases ?? (backup.database?.name ? [backup.database.name] : []), [backup.databases, backup.database?.name]);

  const filteredDatabases = useMemo(() => {
    const query = databaseFilter.trim().toLowerCase();
    if (!query) {
      return databases;
    }

    return databases.filter((name) => name.toLowerCase().includes(query));
  }, [databases, databaseFilter]);

  const visibleColumns = useMemo(() => {
    const hidden = isPgBackRest ? ['database_engine', 'restored_to', 'restored_at'] : ['name', 'host_server_name'];

    return columns.filter((column) => !('accessorKey' in column && hidden.includes(String(column.accessorKey))));
  }, [isPgBackRest]);

  const activeRestores = useMemo(() => restores.filter((restore) => restore.active), [restores]);
  const restoring = activeRestores.length > 0;

  useEffect(() => {
    if (!restoring) {
      return;
    }

    const interval = window.setInterval(() => router.reload({ only: ['restores'] }), 10_000);

    return () => window.clearInterval(interval);
  }, [restoring]);

  const runBackupForm = useForm();
  const runBackup = () => {
    runBackupForm.post(`/servers/${server.id}/backups/${backup.id}/run`, {
      preserveScroll: true,
    });
  };

  const stateLabel = backup.status ?? (backup.enabled ? 'enabled' : 'disabled');
  const stateColor = backup.status_color ?? (backup.enabled ? 'success' : 'gray');
  const scheduleLabel = configs?.cronjob_intervals?.[backup.interval] ?? backup.interval;

  const filesTable = <DataTable columns={visibleColumns} paginatedData={files} />;

  return (
    <ServerLayout>
      <Head title={`Backups - ${server.name}`} />

      <Container>
        <HeaderContainer>
          <div className="flex min-w-0 items-center gap-2.5">
            <Button variant="ghost" size="icon" asChild className="size-8 shrink-0" aria-label="Back to backups">
              <Link href={`/servers/${server.id}/backups`}>
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">{isPgBackRest ? 'pgBackRest' : 'Database backup'}</h2>
              {isPgBackRest && backup.pgbackrest?.stanza && <CopyableBadge text={backup.pgbackrest.stanza} />}
              {!isPgBackRest && backup.database?.name && <CopyableBadge text={backup.database.name} />}
              <Badge variant={stateColor}>{stateLabel}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isPgBackRest && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <RotateCcwIcon className="size-4" />
                    <span>Restore</span>
                    <ChevronDownIcon className="size-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => dialog.backupRestoreToServer.open({ backup })}>Restore to a new server</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => dialog.pgBackRestRestore.open({ backup })}>Restore commands</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="outline" onClick={() => dialog.backupLogs.open({ backup })}>
              <FileTextIcon className="size-4" />
              <span>View logs</span>
            </Button>

            <Button onClick={runBackup} disabled={runBackupForm.processing || !backup.enabled || backup.status !== null}>
              {runBackupForm.processing ? <LoaderCircleIcon className="animate-spin" /> : <CloudUploadIcon />}
              <span>Run backup</span>
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Backup settings">
                  <MoreHorizontalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <BackupMenuItems backup={backup} includeFilesLink={false} includeRun={false} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </HeaderContainer>

        <BackupHealthAlerts
          items={backup.problems.length > 0 ? [{ id: backup.id, title: 'This backup needs attention', problems: backup.problems }] : []}
          hasNotificationChannels={page.props.hasNotificationChannels}
        />

        {activeRestores.map((restore) => (
          <div key={restore.id} className="bg-info/5 border-info/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <LoaderCircleIcon className="text-info size-4 shrink-0 animate-spin" />
              <span className="font-medium">
                Restoring to{' '}
                {restore.server_id && restore.server_name ? (
                  <Link href={`/servers/${restore.server_id}`} className="underline">
                    {restore.server_name}
                  </Link>
                ) : (
                  'new server'
                )}
              </span>
              {restore.step && <span className="text-muted-foreground truncate font-mono text-xs">{restore.step}</span>}
            </div>
            <Badge variant={restore.status_color}>{restore.status}</Badge>
          </div>
        ))}

        <div className="bg-card grid grid-cols-2 divide-y rounded-lg border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="text-muted-foreground text-xs">Last backup</span>
            {backup.last_file ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={backup.last_file.status_color}>{backup.last_file.status}</Badge>
                <RelativeDate date={backup.last_file.created_at} />
                {backup.last_file.size !== null && (
                  <span className="text-muted-foreground text-xs tabular-nums">· {formatBytes(backup.last_file.size, 1)}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">None yet</span>
            )}
          </div>

          {isPgBackRest ? (
            <>
              <div className="flex flex-col gap-1 px-4 py-3">
                <span className="text-muted-foreground text-xs">Last full</span>
                <div className="flex flex-wrap items-center gap-2">
                  <RelativeDate date={backup.last_full_at} className="text-foreground text-sm font-medium" />
                  {backup.pgbackrest?.strategy && (
                    <Badge variant="outline" className="text-[11px] font-normal capitalize">
                      {backup.pgbackrest.strategy}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1 px-4 py-3">
                <span className="text-muted-foreground text-xs">Health checks</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CheckStatusPill
                    label="Check"
                    result={backup.pgbackrest?.last_check_result ?? null}
                    checkedAt={backup.pgbackrest?.last_checked_at ?? null}
                  />
                  <CheckStatusPill
                    label="Verify"
                    result={backup.pgbackrest?.last_verify_result ?? null}
                    checkedAt={backup.pgbackrest?.last_verified_at ?? null}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1 px-4 py-3">
                <span className="text-muted-foreground text-xs">Schedule</span>
                <span className="truncate text-sm font-medium">{scheduleLabel}</span>
              </div>

              <div className="flex flex-col gap-1 px-4 py-3">
                <span className="text-muted-foreground text-xs">Retention</span>
                <span className="text-sm font-medium">Keep {backup.keep_backups}</span>
              </div>
            </>
          )}

          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="text-muted-foreground text-xs">Storage</span>
            <div className="flex min-w-0 items-center gap-1.5">
              <HardDriveIcon className="text-muted-foreground size-3.5 shrink-0" />
              <span title={backup.storage?.profile} className="truncate text-sm font-medium">
                {backup.storage?.profile ?? '-'}
              </span>
            </div>
          </div>
        </div>

        {isPgBackRest && databases.length > 0 && (
          <div className="bg-card flex flex-col gap-2.5 rounded-lg border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="text-muted-foreground size-4" />
                <span className="text-sm font-medium">Databases</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {databases.length}
                </Badge>
              </div>
              {databases.length > 10 && (
                <div className="relative w-48">
                  <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    value={databaseFilter}
                    onChange={(e) => setDatabaseFilter(e.target.value)}
                    placeholder="Filter databases..."
                    aria-label="Filter databases"
                    className="h-7 pl-8 text-xs"
                  />
                </div>
              )}
            </div>
            <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
              {filteredDatabases.length > 0 ? (
                filteredDatabases.map((name) => (
                  <span key={name} className="bg-muted/60 text-foreground rounded-md border px-2 py-0.5 font-mono text-xs">
                    {name}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-xs">No matching databases.</span>
              )}
            </div>
          </div>
        )}

        {restores.length > 0 ? (
          <Tabs defaultValue="files" className="flex flex-col gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="files" className="gap-1.5">
                <CloudUploadIcon className="size-3.5" />
                <span>Files</span>
              </TabsTrigger>
              <TabsTrigger value="restores" className="gap-1.5">
                <HistoryIcon className="size-3.5" />
                <span>Restores</span>
                <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[11px]">
                  {restores.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-0">
              {filesTable}
            </TabsContent>

            <TabsContent value="restores" className="mt-0">
              <div className="bg-card divide-y rounded-lg border">
                {restores.map((restore) => (
                  <div key={restore.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                      {restore.server_id && restore.server_name ? (
                        <Link href={`/servers/${restore.server_id}`} className="font-medium hover:underline">
                          {restore.server_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground font-medium">Deleted server</span>
                      )}
                      <span className="text-muted-foreground">·</span>
                      <RestoreTargetLabel restore={restore} />
                      <span className="text-muted-foreground">·</span>
                      <RelativeDate date={restore.created_at} />
                      {restore.active && restore.step && (
                        <span className="text-muted-foreground font-mono text-xs">({restore.step})</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={restore.status_color}>{restore.status}</Badge>
                      <ErrorIndicator error={restore.message} label="Restore error" />
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          filesTable
        )}
      </Container>
    </ServerLayout>
  );
}
