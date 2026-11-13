import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plugin } from '@/types/plugin';
import { useDialog } from '@/hooks/use-dialog';

export default function InstallPlugin({ plugin }: { plugin: Plugin }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      onSelect={() =>
        dialog.confirm.open({
          title: 'Install plugin',
          description: translateText("Are you sure you want to install the plugin located at :value?", { value: plugin.folder }),
          confirmLabel: 'Install',
          method: 'patch',
          url: "/admin/plugins/install",
          data: { id: plugin.id },
        })
      }
    >
      {translateText('Install')}
    </DropdownMenuItem>
  );
}
