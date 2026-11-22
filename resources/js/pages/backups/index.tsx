import { Head, Link, router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ServerLayout from '@/layouts/server/layout';
import SettingsLayout from '@/layouts/settings/layout';
import { ArrowRightIcon, InfoIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { Backup } from '@/types/backup';
import { VitoTable } from '@/components/vito-table';
import BackupActions from '@/pages/backups/components/backup-actions';
import BackupHealthAlerts from '@/pages/backups/components/backup-health-alerts';
import BackupDatabasesCell from '@/pages/backups/components/backup-databases-cell';
import RelativeDate from '@/pages/backups/components/relative-date';
import ErrorIndicator from '@/components/error-indicator';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';

type Page = {
  server?: Server;
  backups: InertiaTableData;
  attention: { id: number; server_id: number; title: string; problems: string[] }[];
  hasNotificationChannels: boolean;
  replicaOf?: { server_id: number; name: string | null; backup_id: number | null } | null;
};

function getBackup(row: Row): Backup {
  return asRow<{ resource: Backup }>(row, ['resource']).resource;
}

function LastBackupCell({ row }: CellRenderProps) {
  const backup = getBackup(row);
  const file = backup.last_file;

  if (!file) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={file.status_color}>{file.status}</Badge>
      <RelativeDate date={file.created_at} />
      <ErrorIndicator error={file.message} label="Last backup error" />
    </div>
  );
}

function StatusCell({ row }: CellRenderProps) {
  const backup = getBackup(row);
  const label = backup.status ?? (backup.enabled ? 'enabled' : 'disabled');
  const color = backup.status_color ?? (backup.enabled ? 'success' : 'gray');

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={color}>{label}</Badge>
      {backup.problems.length > 0 && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-destructive inline-flex cursor-help items-center"
              aria-label={`${backup.problems.length} backup issues`}
            >
              <TriangleAlertIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {backup.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default function Backups() {
  const page = usePage<Page>();
  const dialog = useDialog();

  const Comp = page.props.server ? ServerLayout : SettingsLayout;
  const columnWidths: Record<string, string> = page.props.server
    ? {
        actions: '3.5rem',
        type: '7.25rem',
        'storage.profile': '17%',
        last_file_status: '19%',
        last_full_at: '11%',
        state: '11%',
      }
    : {
        actions: '3.5rem',
        'server.name': '14%',
        type: '7rem',
        'storage.profile': '15%',
        last_file_status: '17%',
        last_full_at: '10%',
        state: '10%',
      };

  return (
    <Comp>
      <Head title={`Backups${page.props.server ? ' - ' + page.props.server.name : ''}`} />

      <Container>
        <HeaderContainer>
          <Heading title="Backups" />
          <div className="flex items-center gap-2">
            <Button onClick={() => dialog.backupCreate.open({ server: page.props.server })}>
              <PlusIcon />
              <span className="hidden lg:block">Create</span>
            </Button>
          </div>
        </HeaderContainer>

        {page.props.replicaOf && (
          <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <InfoIcon className="text-muted-foreground size-4 shrink-0" />
              <span className="text-muted-foreground">
                Replica of <span className="text-foreground font-medium">{page.props.replicaOf.name}</span>. Cluster backups are managed on the primary.
              </span>
            </div>
            {page.props.replicaOf.backup_id && (
              <Button variant="ghost" size="sm" asChild className="h-7 shrink-0 px-2.5 text-xs">
                <Link href={`/servers/${page.props.replicaOf.server_id}/backups/${page.props.replicaOf.backup_id}/files`}>
                  View cluster backups
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        )}

        <BackupHealthAlerts
          items={page.props.attention.map((backup) => ({ ...backup, href: `/servers/${backup.server_id}/backups/${backup.id}/files` }))}
          hasNotificationChannels={page.props.hasNotificationChannels}
        />

        <VitoTable
          fitContent
          columnWidths={columnWidths}
          tableData={page.props.backups}
          actions={(row: Row) => <BackupActions backup={getBackup(row)} />}
          onRowClick={(row: Row) => {
            const backup = getBackup(row);
            router.visit(`/servers/${backup.server_id}/backups/${backup.id}/files`);
          }}
          cellRenderers={{
            'server.name': ({ row, value }) => (
              <Link
                href={`/servers/${row.server_id as number}`}
                title={String(value ?? '')}
                className="text-foreground block truncate font-medium hover:underline"
              >
                {String(value ?? '-')}
              </Link>
            ),
            type: ({ row }) => {
              const backup = getBackup(row);

              return (
                <Badge variant={backup.type === 'pgbackrest' ? 'info' : 'secondary'}>
                  {backup.type === 'pgbackrest' ? 'pgBackRest' : 'Database'}
                </Badge>
              );
            },
            target: ({ row }) => <BackupDatabasesCell backup={getBackup(row)} />,
            'storage.profile': ({ value }) => (
              <span title={String(value ?? '')} className="text-muted-foreground block truncate text-xs">
                {String(value ?? '-')}
              </span>
            ),
            last_file_status: LastBackupCell,
            last_full_at: ({ row }) => <RelativeDate date={getBackup(row).last_full_at} />,
            state: StatusCell,
          }}
        />
      </Container>
    </Comp>
  );
}
