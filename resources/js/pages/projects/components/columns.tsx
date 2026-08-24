import DateTime from '@/components/date-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteProject from '@/pages/projects/components/delete-project';
import ProjectForm from '@/pages/projects/components/project-form';
import { SharedData } from '@/types';
import type { Project } from '@/types/project';
import { usePage } from '@inertiajs/react';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { ColumnDef } from '@tanstack/react-table';
import { UsersIcon } from 'lucide-react';
import LeaveProject from '@/pages/projects/components/leave-project';
import { useDialog } from '@/hooks/use-dialog';

const CurrentProject = ({ project }: { project: Project }) => {
  const page = usePage<SharedData>();
  return <>{project.id === page.props.auth.currentProject?.id && <Badge variant="default">current</Badge>}</>;
};

function ProjectActions({ project }: { project: Project }) {
  const dialog = useDialog();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TableActionTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ProjectForm project={project}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
        </ProjectForm>
        <DropdownMenuItem onSelect={() => dialog.projectUsers.open({ project })}>
          <UsersIcon className="size-3.5 mr-2" />
          <span>{project.role === 'user' ? 'View access' : 'Manage access'}</span>
        </DropdownMenuItem>
        {project.role !== 'owner' && (
          <LeaveProject project={project}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Leave project</DropdownMenuItem>
          </LeaveProject>
        )}
        {project.role === 'owner' && (
          <>
            <DropdownMenuSeparator />
            <DeleteProject project={project}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} variant="destructive">
                Delete Project
              </DropdownMenuItem>
            </DeleteProject>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<Project>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      const users = row.original.users?.filter((u) => u.type === 'user') ?? [];
      const count = users.length;

      return (
        <div className="flex items-center space-x-1.5">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs font-normal">({count})</span>
          <CurrentProject project={row.original} />
        </div>
      );
    },
  },
  {
    id: 'access',
    header: 'Access',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const users = row.original.users.filter((user) => user.type === 'user');

      return (
        <div className="flex max-w-md flex-wrap gap-1">
          {users.map((user) => (
            <Badge key={user.id} variant="outline" title={user.email}>
              {user.name ?? user.email}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <Badge variant="outline">{row.original.role}</Badge>;
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
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return <ProjectActions project={row.original} />;
    },
  },
];
