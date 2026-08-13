import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, XIcon } from 'lucide-react';
import { ProjectUser } from '@/types/project-user';
import { Badge } from '@/components/ui/badge';
import { useDialog } from '@/hooks/use-dialog';
import { Link } from '@inertiajs/react';

function Actions({ invitation }: { invitation: ProjectUser }) {
  const dialog = useDialog();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          dialog.confirm.open({
            title: `Reject invitation to ${invitation.project_name}`,
            description: 'Are you sure you want to reject joining this project?',
            variant: 'destructive',
            confirmLabel: 'Reject',
            method: 'delete',
            url: route('projects.leave', { project: invitation.project_id }),
          })
        }
      >
        <XIcon />
        Reject
      </Button>
      <Button size="sm" asChild>
        <Link href={route('projects.invitations.accept', { project: invitation.project_id })}>
          <CheckIcon />
          Accept & join
        </Link>
      </Button>
    </div>
  );
}

export const columns: ColumnDef<ProjectUser>[] = [
  {
    accessorKey: 'project_name',
    header: 'Project name',
    enableColumnFilter: true,
    enableSorting: true,
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
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return <Actions invitation={row.original} />;
    },
  },
];
