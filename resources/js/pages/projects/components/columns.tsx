import DateTime from '@/components/date-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeleteProject from '@/pages/projects/components/delete-project';
import ProjectForm from '@/pages/projects/components/project-form';
import { SharedData } from '@/types';
import type { Project } from '@/types/project';
import { usePage } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { MoreVerticalIcon, UsersIcon } from 'lucide-react';
import LeaveProject from '@/pages/projects/components/leave-project';
import { useDialog } from '@/hooks/use-dialog';

const CurrentProject = ({ project }: { project: Project }) => {
  const page = usePage<SharedData>();
  return <>{project.id === page.props.auth.currentProject?.id && <Badge variant="default">current</Badge>}</>;
};

function ProjectActions({ project }: { project: Project }) {
  const dialog = useDialog();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => dialog.projectUsers.open({ project })}>
        <UsersIcon />
        {project.role === 'user' ? 'View access' : 'Manage access'}
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ProjectForm project={project}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
          </ProjectForm>
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
    </div>
  );
}

export const columns: ColumnDef<Project>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return (
        <div className="flex items-center space-x-1">
          <span>{row.original.name}</span> <CurrentProject project={row.original} />
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
