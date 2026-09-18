import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { Link, useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { Backup } from '@/types/backup';
import { SharedData } from '@/types';
import { useDialog } from '@/hooks/use-dialog';

function Edit({ backup }: { backup: Backup }) {
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.backupEdit.open({ backup })}>Edit</DropdownMenuItem>;
}

function Passphrase({ backup }: { backup: Backup }) {
  const dialog = useDialog();
  const isAdmin = usePage<SharedData>().props.auth.user?.is_admin;

  if (backup.type !== 'pgbackrest' || !isAdmin) {
    return null;
  }

  return <DropdownMenuItem onSelect={() => dialog.pgBackRestPassphrase.open({ backup })}>Encryption passphrase</DropdownMenuItem>;
}

function ToggleEnabled({ backup }: { backup: Backup }) {
  const form = useForm();

  const submit = () => {
    form.post(route(backup.enabled ? 'backups.disable' : 'backups.enable', { server: backup.server_id, backup: backup.id }), {
      preserveScroll: true,
    });
  };

  return (
    <DropdownMenuItem onClick={submit} disabled={form.processing}>
      {backup.enabled ? 'Disable' : 'Enable'}
    </DropdownMenuItem>
  );
}

function Delete({ backup }: { backup: Backup }) {
  const dialog = useDialog();
  const target =
    (backup.type === 'pgbackrest' ? 'PostgreSQL cluster' : backup.type === 'database' ? backup.database?.name : backup.path) ?? `#${backup.id}`;

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: `Delete backup [${target}]`,
          description:
            backup.type === 'pgbackrest'
              ? 'Vito stops pgBackRest backups and WAL archiving on this server. Backups already in S3 are kept. Save the encryption passphrase first, because without it they cannot be restored.'
              : `Are you sure you want to delete this backup: ${target}? All backup files will be deleted and this action cannot be undone.`,
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: route('backups.destroy', { server: backup.server_id, backup: backup.id }),
        })
      }
    >
      Delete
    </DropdownMenuItem>
  );
}

export default function BackupActions({ backup }: { backup: Backup }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {backup.status === 'deleting' ? (
        <span className="flex h-8 w-8 items-center justify-center" aria-label="Deleting backup">
          <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
        </span>
      ) : (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <TableActionTrigger />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <Edit backup={backup} />
            <ToggleEnabled backup={backup} />
            <DropdownMenuItem asChild>
              <Link href={route('backup-files', { server: backup.server_id, backup: backup.id })}>Files</Link>
            </DropdownMenuItem>
            <Passphrase backup={backup} />
            <DropdownMenuSeparator />
            <Delete backup={backup} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
