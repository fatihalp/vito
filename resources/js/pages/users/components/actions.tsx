import { User } from '@/types/user';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import DeleteUser from '@/pages/users/components/delete-user';
import UserForm from '@/pages/users/components/user-form';

export default function UserActions({ user }: { user: User }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <TableActionTrigger />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <UserForm user={user}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>
        </UserForm>
        <DropdownMenuSeparator />
        <DeleteUser user={user}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DeleteUser>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
