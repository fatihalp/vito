import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { FirewallRule } from '@/types/firewall';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ firewallRule }: { firewallRule: FirewallRule }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete rule [:value]", { value: firewallRule.name }),
          description: translateText("Are you sure you want to delete rule :value? This action cannot be undone.", { value: firewallRule.name }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/servers/${firewallRule.server_id}/firewall/${firewallRule.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
