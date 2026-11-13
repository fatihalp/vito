import { useTranslate } from '@/hooks/use-translate';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SharedData } from '@/types';
import type { Project } from '@/types/project';
import { Link, usePage } from '@inertiajs/react';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { ColumnDef } from '@tanstack/react-table';
import { UsersIcon } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';

import { ProjectUser } from '@/types/project-user';

const CurrentProject = ({ project }: { project: Project }) => {
  const translateText = useTranslate();
  const page = usePage<SharedData>();
  return <>{project.id === page.props.auth.currentProject?.id && <Badge variant="default">{translateText("current")}</Badge>}</>;
};

function getActiveRegisteredUsers(project: Project): ProjectUser[] {
  return (project.users || []).filter((user) => user.type === 'user' && Boolean(user.name || user.email));
}

export function ProjectActions({ project }: { project: Project }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  const page = usePage<SharedData>();
  const canDelete = project.role === 'owner' || page.props.auth.user.is_admin;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TableActionTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => dialog.projectForm.open({ project })}>{translateText('Edit')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dialog.projectUsers.open({ project })}>
          <UsersIcon className="size-3.5 mr-2" />
          <span>{project.role === 'user' ? translateText("View access") : translateText("Manage access")}</span>
        </DropdownMenuItem>
        {project.role !== 'owner' && (
          <DropdownMenuItem
            onSelect={() => dialog.confirm.open({
              title: translateText("Leave :value", { value: project.name }),
              description: 'Are you sure you want to leave this project?',
              confirmLabel: 'Leave',
              variant: 'destructive',
              method: 'delete',
              url: `/settings/projects/${project.id}/leave`,
            })}
          >
            {translateText("Leave project")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                dialog.confirm.open({
                  title: translateText("Delete :value", { value: project.name }),
                  description: translateText("Are you sure you want to delete :value?", { value: project.name }),
                  variant: 'destructive',
                  confirmLabel: 'Delete',
                  method: 'delete',
                  url: `/settings/projects/${project.id}`,
                })
              }
            >
              {translateText('Delete')}
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
      return (
        <div className="flex min-w-0 items-center gap-2">
          <Link href={`/servers?project=${row.original.id}`} className="truncate font-medium hover:underline">
            {row.original.name}
          </Link>
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
      return <span className="tabular-nums">{row.original.servers_count ?? 0}</span>;
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
    header: 'Members',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      const users = getActiveRegisteredUsers(row.original);

      return (
        <span className="text-muted-foreground text-sm" title={users.map((user) => user.name || user.email).join(', ')}>
          {users.length} {users.length === 1 ? 'member' : 'members'}
        </span>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      return <span className="text-muted-foreground text-sm capitalize">{row.original.role}</span>;
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
