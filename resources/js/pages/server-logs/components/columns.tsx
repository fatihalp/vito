import { ColumnDef } from '@tanstack/react-table';
import type { ServerLog } from '@/types/server-log';
import { ReactNode } from 'react';
import DateTime from '@/components/date-time';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';
import { humanizeStep } from '@/lib/utils';

export function View({ serverLog, label = 'View' }: { serverLog: ServerLog; label?: string }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem onSelect={() => dialog.logViewer.open({ serverId: serverLog.server_id, logId: serverLog.id, title: label })}>
      {label}
    </DropdownMenuItem>
  );
}

export function Download({ serverLog, children }: { serverLog: ServerLog; children: ReactNode }) {
  return (
    <a href={route('logs.download', { server: serverLog.server_id, log: serverLog.id })} target="_blank">
      {children}
    </a>
  );
}

function Clear({ serverLog }: { serverLog: ServerLog }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      onSelect={() =>
        dialog.confirm.open({
          title: `Clear ${serverLog.name}`,
          description: `Are you sure you want to clear the contents of ${serverLog.name}? This will remove all content from the log file but keep the file itself.`,
          confirmLabel: 'Clear',
          method: 'post',
          url: route('logs.clear', { server: serverLog.server_id, log: serverLog.id }),
        })
      }
    >
      Clear
    </DropdownMenuItem>
  );
}

function Delete({ serverLog }: { serverLog: ServerLog }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: `Delete ${serverLog.name}`,
          description: `Are you sure you want to delete ${serverLog.name}?`,
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: route('logs.destroy', { server: serverLog.server_id, log: serverLog.id }),
        })
      }
    >
      Delete
    </DropdownMenuItem>
  );
}

export const columns: ColumnDef<ServerLog>[] = [
  {
    accessorKey: 'name',
    header: 'Event',
    enableColumnFilter: true,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{humanizeStep(row.original.type) || row.original.name}</span>
        <span className="text-muted-foreground font-mono text-xs">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created At',
    enableSorting: true,
    cell: ({ row }) => {
      return <DateTime date={row.original.created_at} relative />;
    },
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <TableActionTrigger />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <View serverLog={row.original} />
              <Download serverLog={row.original}>
                <DropdownMenuItem>Download</DropdownMenuItem>
              </Download>
              <DropdownMenuSeparator />
              {row.original.is_remote && <Clear serverLog={row.original} />}
              <Delete serverLog={row.original} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
