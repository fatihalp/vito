import { useTranslate } from '@/hooks/use-translate';
import { Service } from '@/types/service';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export function ResyncStats({ service }: { service: Service }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.serviceResyncStats.open({ service })}>{translateText("Re-sync stats scripts")}</DropdownMenuItem>;
}
