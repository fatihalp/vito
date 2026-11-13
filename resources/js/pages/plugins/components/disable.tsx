import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plugin } from '@/types/plugin';
import { useDialog } from '@/hooks/use-dialog';

export default function Disable({ plugin }: { plugin: Plugin }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Disable plugin',
          description: translateText("Are you sure you want to disable the plugin :value?", { value: plugin.name ?? plugin.folder }),
          variant: 'destructive',
          confirmLabel: 'Disable',
          method: 'patch',
          url: "/admin/plugins/disable",
          data: { id: plugin.id },
        })
      }
    >
      {translateText('Disable')}
    </DropdownMenuItem>
  );
}
