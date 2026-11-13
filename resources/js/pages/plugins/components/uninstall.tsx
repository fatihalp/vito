import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plugin } from '@/types/plugin';
import { useDialog } from '@/hooks/use-dialog';

export default function Uninstall({ plugin }: { plugin: Plugin }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  const label = plugin.is_installed ? 'Uninstall' : 'Remove';

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText(":value Plugin", { value: translateText(label) }),
          description: translateText("Are you sure you want to :value the plugin :value2?", { value: translateText(label), value2: plugin.name ?? plugin.folder }),
          variant: 'destructive',
          confirmLabel: label,
          method: 'delete',
          url: "/admin/plugins/uninstall",
          data: { id: plugin.id },
        })
      }
    >
      {translateText(label)}
    </DropdownMenuItem>
  );
}
