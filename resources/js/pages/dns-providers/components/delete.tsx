import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DNSProvider } from '@/types/dns-provider';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ dnsProvider }: { dnsProvider: DNSProvider }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete :value", { value: dnsProvider.name }),
          description: translateText("Are you sure you want to delete :value?", { value: dnsProvider.name }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/settings/dns-providers/${dnsProvider.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
