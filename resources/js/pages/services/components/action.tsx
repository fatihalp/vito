import { useTranslate } from '@/hooks/use-translate';
import { withQuery } from '@/lib/url';
import { Service } from '@/types/service';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export function Action({ type, service }: { type: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable'; service: Service }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      className="capitalize"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText(":value service", { value: translateText(type) }),
          description: translateText("Are you sure you want to :value the service?", { value: translateText(type) }),
          variant: ['disable', 'stop'].includes(type) ? 'destructive' : 'default',
          confirmLabel: type,
          method: 'post',
          url: withQuery(`/servers/${service.server_id}/services/${service.id}`, { action: type }),
          data: { action: type },
        })
      }
    >
      {translateText(type)}
    </DropdownMenuItem>
  );
}
