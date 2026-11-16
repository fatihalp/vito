import { Service } from '@/types/service';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export function ResyncStats({ service }: { service: Service }) {
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.serviceResyncStats.open({ service })}>Re-sync stats scripts</DropdownMenuItem>;
}
