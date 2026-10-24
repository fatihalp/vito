import DateTime from '@/components/date-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProjectForm from '@/pages/projects/components/project-form';
import { SharedData } from '@/types';
import type { Project } from '@/types/project';
import { usePage } from '@inertiajs/react';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { ColumnDef } from '@tanstack/react-table';
import { UsersIcon } from 'lucide-react';
import LeaveProject from '@/pages/projects/components/leave-project';
import { useDialog } from '@/hooks/use-dialog';

import { ProjectUser } from '@/types/project-user';

const CurrentProject = ({ project }: { project: Project }) => {
  const page = usePage<SharedData>();
  return <>{project.id === page.props.auth.currentProject?.id && <Badge variant="default">current</Badge>}</>;
};

function getActiveRegisteredUsers(project: Project): ProjectUser[] {
  return (project.users || []).filter((user) => user.type === 'user' && Boolean(user.name || user.email));
}

function ProjectActions({ project }: { project: Project }) {
  const dialog = useDialog();
  const page = usePage<SharedData>();
  const canDelete = project.role === 'owner' || page.props.auth.user.is_admin;

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
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                dialog.confirm.open({
                  title: `Delete ${project.name}`,
                  description: `Are you sure you want to delete ${project.name}?`,
                  variant: 'destructive',
                  confirmLabel: 'Delete',
                  method: 'delete',
                  url: `/settings/projects/${project.id}`,
                })
              }
            >
              Delete
            </DropdownMenuItem>
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
      const users = getActiveRegisteredUsers(row.original);
      const count = users.length;
      const serversCount = row.original.servers_count ?? 0;
      const monthlyCost = row.original.monthly_cost;

      return (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs font-normal">({count})</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {serversCount} {serversCount === 1 ? 'server' : 'servers'}
          </Badge>
          {monthlyCost && monthlyCost.amount > 0 && (
            <Badge variant="outline" className="font-mono text-xs font-normal">
              {monthlyCost.formatted}
            </Badge>
          )}
          <CurrentProject project={row.original} />
        </div>
      );
    },
  },
  {
    accessorKey: 'servers_count',
    header: 'Servers',
    enableColumnFilter: false,
    enableSorting: true,
    cell: ({ row }) => {
      return <Badge variant="outline">{row.original.servers_count ?? 0}</Badge>;
    },
  },
  {
    accessorKey: 'monthly_cost',
    header: 'Cost',
    enableColumnFilter: false,
    enableSorting: true,
    cell: ({ row }) => {
      const monthlyCost = row.original.monthly_cost;
      if (!monthlyCost || monthlyCost.amount <= 0) {
        return <span className="text-muted-foreground text-xs">—</span>;
      }

      return <span className="font-mono text-sm font-medium">{monthlyCost.formatted}</span>;
    },
  },
  {
    id: 'access',
    header: 'Access',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const users = getActiveRegisteredUsers(row.original);

      return (
        <div className="flex max-w-md flex-wrap gap-1">
          {users.map((user) => {
            const label = user.name || user.email;
            if (!label) return null;
            return (
              <Badge key={user.id} variant="outline" title={user.email || user.name}>
                {label}
              </Badge>
            );
          })}
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
