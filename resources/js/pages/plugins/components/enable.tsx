import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plugin } from '@/types/plugin';
import { useDialog } from '@/hooks/use-dialog';

export default function EnablePlugin({ plugin }: { plugin: Plugin }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      onSelect={() =>
        dialog.confirm.open({
          title: 'Enable plugin',
          description: translateText("Are you sure you want to enable the plugin :value?", { value: plugin.name ?? plugin.folder }),
          confirmLabel: 'Enable',
          method: 'patch',
          url: "/admin/plugins/enable",
          data: { id: plugin.id },
        })
      }
    >
      {translateText('Enable')}
    </DropdownMenuItem>
  );
}
