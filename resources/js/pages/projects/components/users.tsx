import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDialog } from '@/hooks/use-dialog';
import { SharedData } from '@/types';
import { Project } from '@/types/project';
import { ProjectUser } from '@/types/project-user';
import { usePage } from '@inertiajs/react';
import { ColumnDef } from '@tanstack/react-table';
import { TrashIcon } from 'lucide-react';

function RemoveUserAction({ user }: { user: ProjectUser }) {
  const dialog = useDialog();
  const page = usePage<SharedData>();

  if (user.user_id === page.props.auth.user.id || user.role === 'owner') {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="size-7"
      aria-label={`Remove ${user.email} from project`}
      onClick={() =>
        dialog.confirm.open({
          title: 'Remove user',
          description: `Are you sure you want to remove ${user.email} from this project?`,
          variant: 'destructive',
          confirmLabel: 'Remove',
          method: 'delete',
          url: route('projects.users.destroy', { project: user.project_id, id: user.id }),
        })
      }
    >
      <TrashIcon className="size-3" />
    </Button>
  );
}

const columns: ColumnDef<ProjectUser>[] = [
  {
    accessorKey: 'email',
    header: 'Email',
    enableColumnFilter: true,
    enableSorting: true,
  },
  {
    id: 'role',
    header: 'Role',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return <Badge variant="outline">{row.original.role}</Badge>;
    },
  },
  {
    id: 'status',
    header: 'Status',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return <Badge variant="outline">{row.original.type === 'user' ? 'registered' : 'invited'}</Badge>;
    },
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return (
        <div className="flex items-center justify-end">
          <RemoveUserAction user={row.original} />
        </div>
      );
    },
  },
];

export default function Users({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const dialog = useDialog();
  const canManageAccess = project.role === 'owner' || project.role === 'admin';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Project users</SheetTitle>
          <SheetDescription className="sr-only">Here you can manage project users</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <DataTable columns={canManageAccess ? columns : columns.filter((column) => column.id !== 'actions')} data={project.users || []} />
        </div>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            {canManageAccess && <Button onClick={() => dialog.projectInvite.open({ project })}>Invite user</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
