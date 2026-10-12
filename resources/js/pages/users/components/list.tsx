import { ColumnDef } from '@tanstack/react-table';
import type { User } from '@/types/user';
import { DataTable } from '@/components/data-table';
import { usePage } from '@inertiajs/react';
import UserActions from '@/pages/users/components/actions';
import DateTime from '@/components/date-time';
import { PaginatedData } from '@/types';
import { Badge } from '@/components/ui/badge';

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    enableColumnFilter: true,
  },
  {
    id: 'role',
    header: 'Access level',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={row.original.is_admin ? 'default' : 'outline'}>
        {row.original.is_admin ? 'System administrator' : 'Selected projects'}
      </Badge>
    ),
  },
  {
    id: 'projects',
    header: 'Projects',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.is_admin) {
        return <Badge>All projects</Badge>;
      }
      const access = row.original.project_access ?? [];
      return (
        <div className="flex max-w-sm flex-wrap gap-1">
          {access.map((membership) => (
            <Badge key={membership.project_id} variant="outline" className="text-xs font-normal">
              {membership.name || `Project #${membership.project_id}`}{membership.role === 'owner' && ' · Owner'}
            </Badge>
          ))}
          {access.length === 0 && <span className="text-muted-foreground text-xs">No assigned projects</span>}
        </div>
      );
    },
  },
  {
    accessorKey: 'last_login_at',
    header: 'Last Login',
    enableSorting: true,
    cell: ({ row }) =>
      row.original.last_login_at ? (
        <DateTime date={row.original.last_login_at} format="YYYY-MM-DD HH:mm" />
      ) : (
        <span className="text-xs text-muted-foreground">Never</span>
      ),
  },
  {
    accessorKey: 'last_activity_at',
    header: 'Last Activity',
    enableSorting: true,
    cell: ({ row }) =>
      row.original.last_activity_at ? (
        <DateTime date={row.original.last_activity_at} format="YYYY-MM-DD HH:mm" />
      ) : (
        <span className="text-xs text-muted-foreground">No activity yet</span>
      ),
  },
  {
    id: 'browser_language',
    header: 'Browser / Language',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-col gap-1">
        <span className="text-sm">{row.original.last_login_browser || 'Not recorded'}</span>
        <span className="text-muted-foreground text-xs">{row.original.last_login_language || 'Not recorded'}</span>
      </div>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Created At',
    enableSorting: true,
    cell: ({ row }) => <DateTime date={row.original.created_at} format="YYYY-MM-DD HH:mm" />,
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <UserActions user={row.original} />
      </div>
    ),
  },
];

type Page = {
  users: PaginatedData<User>;
};

export default function UsersList() {
  const page = usePage<Page>();

  return <DataTable columns={columns} paginatedData={page.props.users} />;
}
