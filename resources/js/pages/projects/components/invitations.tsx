import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { ColumnDef } from '@tanstack/react-table';
import { CheckIcon, XIcon } from 'lucide-react';
import { ProjectUser } from '@/types/project-user';
import { Badge } from '@/components/ui/badge';
import { useDialog } from '@/hooks/use-dialog';
import { Link } from '@inertiajs/react';

function Actions({ invitation }: { invitation: ProjectUser }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          dialog.confirm.open({
            title: translateText("Reject invitation to :value", { value: (invitation.project_name ?? '—') }),
            description: 'Are you sure you want to reject joining this project?',
            variant: 'destructive',
            confirmLabel: 'Reject',
            method: 'delete',
            url: `/settings/projects/${invitation.project_id}/leave`,
          })
        }
      >
        <XIcon />
        {translateText('Reject')}
      </Button>
      <Button size="sm" asChild>
        <Link href={`/settings/projects/${invitation.project_id}/invitations/accept`}>
          <CheckIcon />
          {translateText("Accept & join")}
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
