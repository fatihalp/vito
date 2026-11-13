import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { StorageProvider } from '@/types/storage-provider';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ storageProvider }: { storageProvider: StorageProvider }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete :value", { value: storageProvider.name }),
          description: translateText("Are you sure you want to delete :value?", { value: storageProvider.name }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/settings/storage-providers/${storageProvider.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
