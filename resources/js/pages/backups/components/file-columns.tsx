import { TableActionTrigger } from '@/components/table-action-trigger';
import { LoaderCircleIcon } from 'lucide-react';
import { BackupFile } from '@/types/backup-file';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import CopyableBadge from '@/components/copyable-badge';
import { useDialog } from '@/hooks/use-dialog';
import { Backup } from '@/types/backup';
import ErrorIndicator from '@/components/error-indicator';
import RelativeDate from '@/pages/backups/components/relative-date';
import { formatBytes } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import axios from 'axios';
import { toast } from 'sonner';

function Download({ file }: { file: BackupFile }) {
  const page = usePage<SharedData & { backup: Backup }>();

  if (!page.props.auth.user?.is_admin || page.props.backup.storage?.provider !== 's3' || ['failed', 'delete_failed'].includes(file.status)) {
    return null;
  }

  const download = async () => {
    try {
      const { data } = await axios.get<{ url: string }>(
        `/servers/${file.server_id}/backups/${file.backup_id}/files/${file.id}/download`,
      );
      window.location.assign(data.url);
    } catch {
      toast.error('Could not prepare the download link.');
    }
  };

  return <DropdownMenuItem onSelect={() => void download()}>Download</DropdownMenuItem>;
}

function Restore({ backup, file }: { backup: Backup; file: BackupFile }) {
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.backupRestore.open({ backup, file })}>Restore</DropdownMenuItem>;
}

function Delete({ file }: { file: BackupFile }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Delete backup file',
          description: 'Are you sure you want to delete this backup file?',
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/servers/${file.server_id}/backups/${file.backup_id}/files/${file.id}`,
        })
      }
    >
      Delete
    </DropdownMenuItem>
  );
}

const pgBackRestTypeBadges: Record<string, { label: string; variant: 'info' | 'secondary' | 'outline' }> = {
  F: { label: 'Full', variant: 'info' },
  full: { label: 'Full', variant: 'info' },
  D: { label: 'Diff', variant: 'secondary' },
  diff: { label: 'Diff', variant: 'secondary' },
  I: { label: 'Incr', variant: 'outline' },
  incr: { label: 'Incr', variant: 'outline' },
};

export const columns: ColumnDef<BackupFile>[] = [
  {
    accessorKey: 'name',
    header: 'Backup',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      const badge = pgBackRestTypeBadges[row.original.name.slice(-1)] ?? (row.original.type ? pgBackRestTypeBadges[row.original.type] : undefined);

      return (
        <div className="flex min-w-0 items-center gap-2">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          <span title={row.original.name} className="max-w-72 truncate font-mono text-xs">
            {row.original.name}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'host_server_name',
    header: 'Host',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const engine = row.original.database_engine
        ? `${row.original.database_engine === 'postgresql' ? 'pg' : row.original.database_engine} ${row.original.database_version ?? ''}`.trim()
        : null;

      return (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{row.original.host_server_name ?? '-'}</span>
          {engine && (
            <Badge variant="outline" className="text-muted-foreground font-mono text-[11px] font-normal">
              {engine}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'database_engine',
    header: 'Engine',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      return row.original.database_engine ? (
        <Badge variant="outline">{`${row.original.database_engine} ${row.original.database_version ?? ''}`.trim()}</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      );
    },
  },
  {
    accessorKey: 'size',
    header: 'Size',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return (
        <span className="text-muted-foreground text-xs tabular-nums">
          {row.original.size === null ? '-' : formatBytes(row.original.size, 2)}
        </span>
      );
    },
  },
  {
    accessorKey: 'restored_to',
    header: 'Restored to',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return row.original.restored_to ? <CopyableBadge text={row.original.restored_to} tooltip /> : <span className="text-muted-foreground">-</span>;
    },
  },
  {
    accessorKey: 'restored_at',
    header: 'Restored',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => <RelativeDate date={row.original.restored_at} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant={row.original.status_color}>{row.original.status}</Badge>
          {row.original.status === 'creating' && row.original.progress !== null && (
            <span className="text-muted-foreground text-xs tabular-nums">{row.original.progress.toFixed(1)}%</span>
          )}
          <ErrorIndicator error={row.original.message} label={`Backup file "${row.original.name}" error`} />
        </div>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => <RelativeDate date={row.original.created_at} />,
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.status === 'creating' || row.original.status === 'deleting') {
        return (
          <div className="flex items-center justify-end">
            <span
              className="flex h-8 w-8 items-center justify-center"
              aria-label={row.original.status === 'deleting' ? 'Deleting backup file' : 'Creating backup file'}
            >
              <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
            </span>
          </div>
        );
      }

      return <FileActions file={row.original} />;
    },
  },
];

function FileActions({ file }: { file: BackupFile }) {
  const dialog = useDialog();
  const backup = usePage<{ backup: Backup }>().props.backup;

  if (backup.type === 'pgbackrest' && file.status !== 'created') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {backup.type === 'pgbackrest' ? (
            <>
              <DropdownMenuItem onSelect={() => dialog.backupRestoreToServer.open({ backup, file })}>Restore to a new server</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => dialog.pgBackRestRestore.open({ backup, file })}>Restore commands</DropdownMenuItem>
            </>
          ) : (
            <>
              <Download file={file} />
              {backup.type === 'database' && <Restore backup={backup} file={file} />}
              <Delete file={file} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
