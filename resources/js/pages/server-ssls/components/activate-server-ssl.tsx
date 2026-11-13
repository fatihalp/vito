import { useTranslate } from '@/hooks/use-translate';
import { SSL } from '@/types/ssl';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export default function ActivateServerSsl({ ssl }: { ssl: SSL }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.activateServerSsl.open({ serverId: ssl.server_id, sslId: ssl.id })}>{translateText("Activate")}</DropdownMenuItem>;
}
