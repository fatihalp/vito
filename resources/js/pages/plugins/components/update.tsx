import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plugin } from '@/types/plugin';
import { useDialog } from '@/hooks/use-dialog';

export default function UpdatePlugin({ plugin }: { plugin: Plugin }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      onSelect={() =>
        dialog.confirm.open({
          title: 'Update plugin',
          description: translateText("Are you sure you want to update the plugin :value to the latest released version?", { value: plugin.name ?? plugin.folder }),
          confirmLabel: 'Update',
          method: 'patch',
          url: "/admin/plugins/update",
          data: { id: plugin.id },
        })
      }
    >
      {translateText('Update')}
    </DropdownMenuItem>
  );
}
