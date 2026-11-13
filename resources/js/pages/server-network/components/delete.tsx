import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ServerIpAddress } from '@/types/server-ip';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ ipAddress }: { ipAddress: ServerIpAddress }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete IP [:value]", { value: ipAddress.ip }),
          description: translateText("Are you sure you want to remove :value from this server? This action cannot be undone.", { value: ipAddress.ip }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/servers/${ipAddress.server_id}/network/ips/${ipAddress.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
