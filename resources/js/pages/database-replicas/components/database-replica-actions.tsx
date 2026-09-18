import { Link } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { useDialog } from '@/hooks/use-dialog';
import { DatabaseReplica } from '@/types/database-replica';

const BUSY = ['pending', 'configuring', 'promoting', 'deleting'];

export default function DatabaseReplicaActions({ replica, failoverEnabled = false }: { replica: DatabaseReplica; failoverEnabled?: boolean }) {
  const dialog = useDialog();
  const server = replica.primary_server_id;

  if (BUSY.includes(replica.status)) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Link href={`${route('database-replicas.show', { server, databaseReplica: replica.id })}#logs`} className="text-muted-foreground text-xs underline">
          Logs
        </Link>
        <span className="flex h-8 w-8 items-center justify-center" aria-label={`Replica is ${replica.status}`}>
          <LoaderCircleIcon className="text-muted-foreground h-4 w-4 animate-spin" />
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={route('database-replicas.show', { server, databaseReplica: replica.id })}>View</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`${route('database-replicas.show', { server, databaseReplica: replica.id })}#logs`}>View logs</Link>
          </DropdownMenuItem>
          {['ready', 'failed', 'needs_rebuild'].includes(replica.status) && (
            <DropdownMenuItem
              onSelect={() =>
                dialog.confirm.open({
                  title: `Rebuild ${replica.replica_server_name}`,
                  description:
                    'Vito restores this server again from the latest pgBackRest backup and replaces its PostgreSQL data. Use it when the replica lost WAL it needed, setup failed, or it is a former primary.',
                  confirmLabel: 'Rebuild',
                  method: 'post',
                  url: route('database-replicas.resync', { server, databaseReplica: replica.id }),
                })
              }
            >
              Rebuild
            </DropdownMenuItem>
          )}
          {failoverEnabled && replica.status === 'ready' && (
            <DropdownMenuItem onSelect={() => dialog.databaseReplicaPromote.open({ replica })}>Fail over to this replica</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              dialog.confirm.open({
                title: `Delete replica ${replica.replica_server_name}`,
                description:
                  'Removes the replication slot, user and firewall access from the primary, stops WAL archiving on the replica and turns it into an independent writable server. No data is deleted. If the replica cannot be reached, Vito asks you to delete it a second time.',
                variant: 'destructive',
                confirmLabel: 'Delete',
                method: 'delete',
                url: route('database-replicas.destroy', { server, databaseReplica: replica.id }),
              })
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
