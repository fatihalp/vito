import { ColumnDef } from '@tanstack/react-table';
import DateTime from '@/components/date-time';
import { SourceControl } from '@/types/source-control';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { useDialog } from '@/hooks/use-dialog';

function Edit({ sourceControl }: { sourceControl: SourceControl }) {
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.sourceControlEdit.open({ sourceControl })}>Edit</DropdownMenuItem>;
}

function Delete({ sourceControl }: { sourceControl: SourceControl }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: `Delete ${sourceControl.name}`,
          description: `Are you sure you want to delete ${sourceControl.name}?`,
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: route('source-controls.destroy', sourceControl.id),
        })
      }
    >
      Delete
    </DropdownMenuItem>
  );
}

export const columns: ColumnDef<SourceControl>[] = [
  {
    accessorKey: 'provider',
    header: 'Provider',
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    accessorKey: 'user',
    header: 'User',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original.user;
      if (!user) {
        return <span className="text-muted-foreground text-xs">-</span>;
      }

      return (
        <div className="flex items-center gap-1.5" title={user.email}>
          <span className="text-sm font-medium">{user.name}</span>
          {user.email && <span className="text-xs text-muted-foreground">({user.email})</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'project',
    header: 'Project',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.global || !row.original.project_id) {
        return <Badge variant="outline">Global</Badge>;
      }

      return (
        <span className="text-sm font-medium">
          {row.original.project?.name ?? `Project #${row.original.project_id}`}
        </span>
      );
    },
  },
  {
    accessorKey: 'global',
    header: 'Global',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <div>{row.original.global ? <Badge variant="success">yes</Badge> : <Badge variant="danger">no</Badge>}</div>;
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created at',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <DateTime date={row.original.created_at} />;
    },
  },
  {
    accessorKey: 'id',
    header: 'ID',
    enableColumnFilter: true,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const isGithubApp = row.original.provider === 'github-app';
      return (
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <TableActionTrigger />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <Edit sourceControl={row.original} />
              {isGithubApp && row.original.github_app?.html_url && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={row.original.github_app.html_url} target="_blank" rel="noopener noreferrer">
                      Manage permissions
                    </a>
                  </DropdownMenuItem>
                </>
              )}
              {!isGithubApp && (
                <>
                  <DropdownMenuSeparator />
                  <Delete sourceControl={row.original} />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
