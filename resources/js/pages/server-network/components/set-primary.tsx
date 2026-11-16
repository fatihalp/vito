import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ServerIpAddress } from '@/types/server-ip';
import { useDialog } from '@/hooks/use-dialog';

export default function SetPrimary({ ipAddress }: { ipAddress: ServerIpAddress }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Set primary IP [:value]", { value: ipAddress.ip }),
          description: translateText("Make :value the primary address for this server. Pure uses the primary public IP to connect to the server, so only change this if the address is reachable.", { value: ipAddress.ip }),
          confirmLabel: 'Set as primary',
          method: 'post',
          url: `/servers/${ipAddress.server_id}/network/ips/${ipAddress.id}/primary`,
        })
      }
    >
      {translateText("Set as primary")}
    </DropdownMenuItem>
  );
}
