import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Worker } from '@/types/worker';
import { useDialog } from '@/hooks/use-dialog';
import { Link } from '@inertiajs/react';

export function WorkerAction({ type, worker }: { type: 'start' | 'stop' | 'restart'; worker: Worker }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      className="capitalize"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText(":value worker", { value: translateText(type) }),
          description: translateText("Are you sure you want to :value the worker?", { value: translateText(type) }),
          variant: type === 'stop' ? 'destructive' : 'default',
          confirmLabel: type,
          method: 'post',
          url: `/servers/${worker.server_id}/workers/${worker.id}/${type}`,
        })
      }
    >
      {translateText(type)}
    </DropdownMenuItem>
  );
}

export function WorkerLogs({ worker }: { worker: Worker }) {
  const translateText = useTranslate();
  return (
    <DropdownMenuItem asChild>
      <Link href={`/servers/${worker.server_id}/workers/${worker.id}/log`}>
        {translateText('Logs')}
      </Link>
    </DropdownMenuItem>
  );
}

export function WorkerEnvironment({ worker }: { worker: Worker }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.workerEnv.open({ serverId: worker.server_id, workerId: worker.id })}>{translateText('Environment')}</DropdownMenuItem>;
}
