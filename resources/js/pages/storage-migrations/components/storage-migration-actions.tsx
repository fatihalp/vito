import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { Link, useForm } from '@inertiajs/react';
import { StorageMigration } from '@/types/storage-migration';
import { useDialog } from '@/hooks/use-dialog';

function SimpleAction({ storageMigration, action, label, phase = 'all' }: { storageMigration: StorageMigration; action: string; label: string; phase?: 'scan' | 'transfer' | 'all' }) {
  const form = useForm({ phase });

  const submit = () => {
    form.post(`/storage-migrations/${storageMigration.id}/${action}`, {
      preserveScroll: true,
    });
  };

  return (
    <DropdownMenuItem onClick={submit} disabled={form.processing}>
      {label}
    </DropdownMenuItem>
  );
}

function Cancel({ storageMigration }: { storageMigration: StorageMigration }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Cancel storage migration',
          description: 'Are you sure you want to cancel this migration? Objects already copied stay on the target; anything still pending will not be copied.',
          variant: 'destructive',
          confirmLabel: 'Cancel migration',
          method: 'post',
          url: `/storage-migrations/${storageMigration.id}/cancel`,
        })
      }
    >
      {translateText('Cancel')}
    </DropdownMenuItem>
  );
}

function Delete({ storageMigration }: { storageMigration: StorageMigration }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Delete storage migration',
          description: 'This only removes the migration record, it does not delete any objects on the source or target storage.',
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/storage-migrations/${storageMigration.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}

export default function StorageMigrationActions({ storageMigration }: { storageMigration: StorageMigration }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  const isOpen = ['pending', 'scanning', 'running', 'verifying', 'paused'].includes(storageMigration.status);
  const isSettled = !isOpen;

  return (
    <div className="flex items-center justify-end gap-1.5">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href={`/storage-migrations/${storageMigration.id}`}>{translateText('View')}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => dialog.storageMigrationRename.open({ storageMigration })}>{translateText("Rename")}</DropdownMenuItem>

          {isOpen && !storageMigration.scan_completed_at && (
            <SimpleAction
              storageMigration={storageMigration}
              phase="scan"
              action={storageMigration.scan_paused ? 'resume' : 'pause'}
              label={storageMigration.scan_paused ? translateText("Resume scanning") : translateText("Pause scanning")}
            />
          )}
          {isOpen && (
            <SimpleAction
              storageMigration={storageMigration}
              phase="transfer"
              action={storageMigration.transfer_paused ? 'resume' : 'pause'}
              label={storageMigration.transfer_paused ? translateText("Resume transfers") : translateText("Pause transfers")}
            />
          )}
          {['partial', 'failed'].includes(storageMigration.status) && (
            <SimpleAction storageMigration={storageMigration} action="retry-failed" label={translateText("Retry failed")} />
          )}

          {isOpen && (
            <>
              <DropdownMenuSeparator />
              <Cancel storageMigration={storageMigration} />
            </>
          )}
          {isSettled && (
            <>
              <DropdownMenuSeparator />
              <Delete storageMigration={storageMigration} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
