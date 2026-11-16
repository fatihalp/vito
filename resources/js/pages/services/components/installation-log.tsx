import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Service } from '@/types/service';
import { useDialog } from '@/hooks/use-dialog';

export default function InstallationLog({ service }: { service: Service }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  if (!service.log) {
    return null;
  }

  const logId = service.log.id;

  return (
    <DropdownMenuItem onSelect={() => dialog.logViewer.open({ serverId: service.server_id, logId, title: 'Installation Log' })}>
      {translateText("Installation Log")}
    </DropdownMenuItem>
  );
}
