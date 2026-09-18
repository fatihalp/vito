import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import { CloudUploadIcon, FileTextIcon, LoaderCircleIcon } from 'lucide-react';
import { Backup } from '@/types/backup';
import { DataTable } from '@/components/data-table';
import { PaginatedData } from '@/types';
import { BackupFile } from '@/types/backup-file';
import { columns } from '@/pages/backups/components/file-columns';
import CopyableBadge from '@/components/copyable-badge';
import { useRealtime } from '@/hooks/use-socket-events';
import Logs from '@/pages/server-logs/components/logs';
import { useDialog } from '@/hooks/use-dialog';
import BackupHealthAlerts from '@/pages/backups/components/backup-health-alerts';
import { BackupRestore } from '@/types/backup-restore';
import { Badge } from '@/components/ui/badge';

type Page = {
  server: Server;
  backup: Backup;
  files: PaginatedData<BackupFile>;
  hasNotificationChannels: boolean;
  restores: BackupRestore[];
};

export default function Files() {
  const page = usePage<Page>();
  const [showLogs, setShowLogs] = useState(false);
  const [files] = useRealtime<BackupFile>(page.props.files, 'backup-file', { backup_id: page.props.backup.id });

  const dialog = useDialog();
  const isPgBackRest = page.props.backup.type === 'pgbackrest';
  const visibleColumns = useMemo(() => {
    const hidden =
      page.props.backup.type === 'pgbackrest' ? ['restored_to', 'restored_at'] : page.props.backup.type === 'file' ? ['name', 'database_engine'] : ['name'];

    return columns.filter((column) => !('accessorKey' in column && hidden.includes(String(column.accessorKey))));
  }, [page.props.backup.type]);

  const restoring = page.props.restores.some((restore) => restore.active);

  useEffect(() => {
    if (!restoring) return;

    const interval = window.setInterval(() => router.reload({ only: ['restores'] }), 10_000);

    return () => window.clearInterval(interval);
  }, [restoring]);

  const runBackupForm = useForm();
  const runBackup = () => {
    runBackupForm.post(route('backups.run', { server: page.props.server.id, backup: page.props.backup.id }));
  };

  return (
    <ServerLayout>
      <Head title={`Backup files - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <div className="space-y-0.5">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {isPgBackRest ? 'pgBackRest backups of' : 'Backup files of'}
              {page.props.backup.type === 'database' && <CopyableBadge text={page.props.backup.database?.name} />}
              {page.props.backup.type === 'file' && <CopyableBadge text={page.props.backup.path} tooltip />}
              {isPgBackRest && <CopyableBadge text={page.props.backup.pgbackrest?.stanza ?? undefined} />}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isPgBackRest
                ? 'Each backup covers the whole PostgreSQL cluster and runs on a healthy replica when there is one. pgBackRest removes expired backups based on the strategy.'
                : 'Here you can manage the backup files'}
            </p>
            {isPgBackRest && page.props.backup.pgbackrest && (
              <p className="text-muted-foreground text-sm">
                {page.props.backup.pgbackrest.strategy === 'standard' ? 'Standard strategy' : 'Custom strategy'} · last verify:{' '}
                {page.props.backup.pgbackrest.last_verify_result ?? 'not yet'} · last check: {page.props.backup.pgbackrest.last_check_result ?? 'not yet'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPgBackRest && (
              <>
                <Button variant="outline" onClick={() => dialog.backupRestoreToServer.open({ backup: page.props.backup })}>
                  Restore to a new server
                </Button>
                <Button variant="outline" onClick={() => dialog.pgBackRestRestore.open({ backup: page.props.backup })}>
                  Restore commands
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowLogs((visible) => !visible)} aria-expanded={showLogs} aria-controls="backup-server-logs">
              <FileTextIcon />
              {showLogs ? 'Hide logs' : 'View logs'}
            </Button>
            <Button onClick={runBackup}>
              {runBackupForm.processing ? <LoaderCircleIcon className="animate-spin" /> : <CloudUploadIcon />}
              <span className="hidden lg:block">Run backup</span>
            </Button>
          </div>
        </HeaderContainer>

        <BackupHealthAlerts
          items={page.props.backup.problems.length > 0 ? [{ id: page.props.backup.id, title: 'This backup', problems: page.props.backup.problems }] : []}
          hasNotificationChannels={page.props.hasNotificationChannels}
        />

        <DataTable columns={visibleColumns} paginatedData={files} />
        {page.props.restores.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Restores to new servers">
            <h3 className="text-lg font-semibold">Restores to new servers</h3>
            {page.props.restores.map((restore) => (
              <div key={restore.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {restore.server_id && restore.server_name ? (
                      <Link href={route('servers.show', { server: restore.server_id })} className="font-medium underline">
                        {restore.server_name}
                      </Link>
                    ) : (
                      <span className="font-medium">deleted server</span>
                    )}{' '}
                    <span className="text-muted-foreground">
                      ·{' '}
                      {restore.target === 'backup'
                        ? `backup ${restore.backup_file_name ?? ''}`
                        : restore.target === 'time' && restore.target_time
                          ? `point in time ${new Date(restore.target_time).toLocaleString()}`
                          : 'latest'}{' '}
                      · started {new Date(restore.created_at).toLocaleString()}
                    </span>
                  </span>
                  <Badge variant={restore.status_color}>{restore.status}</Badge>
                </div>
                {restore.active && restore.step && <p className="text-muted-foreground font-mono text-xs break-all">{restore.step}</p>}
                {restore.message && <p className="text-destructive font-mono text-xs break-all whitespace-pre-wrap">{restore.message}</p>}
              </div>
            ))}
          </section>
        )}
        {showLogs && (
          <section id="backup-server-logs" className="flex flex-col gap-4" aria-label="Server diagnostic logs">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">Server diagnostic logs</h3>
              <p className="text-muted-foreground text-sm">
                Logs from all operations on this server. Match the time of the failed backup, then open the backup, upload, or deletion log to see its output.
                This list refreshes every five seconds.
              </p>
            </div>
            <Logs server={page.props.server} />
          </section>
        )}
      </Container>
    </ServerLayout>
  );
}
