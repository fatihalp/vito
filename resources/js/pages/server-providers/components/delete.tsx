import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ServerProvider } from '@/types/server-provider';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ serverProvider }: { serverProvider: ServerProvider }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete :value", { value: serverProvider.name }),
          description: translateText("Are you sure you want to delete :value?", { value: serverProvider.name }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/settings/server-providers/${serverProvider.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
