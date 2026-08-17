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
    header: 'Role',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant={row.original.is_admin ? 'default' : 'outline'}>
        {row.original.is_admin ? 'Admin' : 'User'}
      </Badge>
    ),
  },
  {
    id: 'projects',
    header: 'Projects',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const projects = row.original.projects || [];
      if (projects.length === 0) {
        return (
          <span className="text-xs text-muted-foreground">
            {row.original.is_admin ? 'All (Admin)' : 'No projects'}
          </span>
        );
      }

      return (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {projects.map((project) => (
            <Badge key={project.id} variant="secondary" className="text-xs font-normal">
              {project.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Created At',
    enableSorting: true,
    cell: ({ row }) => <DateTime date={row.original.created_at} />,
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
