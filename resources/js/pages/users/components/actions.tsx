import { useTranslate } from '@/hooks/use-translate';
import { User } from '@/types/user';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { useDialog } from '@/hooks/use-dialog';

export default function UserActions({ user }: { user: User }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TableActionTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => dialog.userForm.open({ user })}>{translateText('Edit')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => dialog.confirm.open({
          title: 'Delete user',
          description: translateText("Delete :value? This cannot be undone.", { value: user.name }),
          confirmLabel: 'Delete',
          variant: 'destructive',
          method: 'delete',
          url: `/admin/users/${user.id}`,
        })}>{translateText('Delete')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
