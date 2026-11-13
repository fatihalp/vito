import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SshKey } from '@/types/ssh-key';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ sshKey }: { sshKey: SshKey }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete :value", { value: sshKey.name }),
          description: 'Are you sure you want to delete this key?',
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/settings/ssh-keys/${sshKey.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
