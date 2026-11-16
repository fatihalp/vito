import { User } from '@/types/user';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { useDialog } from '@/hooks/use-dialog';

export default function UserActions({ user }: { user: User }) {
  const dialog = useDialog();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TableActionTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => dialog.userForm.open({ user })}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => dialog.confirm.open({
          title: 'Delete user',
          description: `Delete ${user.name}? This cannot be undone.`,
          confirmLabel: 'Delete',
          variant: 'destructive',
          method: 'delete',
          url: `/admin/users/${user.id}`,
        })}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
