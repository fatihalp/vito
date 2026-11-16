import { useTranslate } from '@/hooks/use-translate';
import { ConfigPath, Service } from '@/types/service';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export default function ConfigFile({ service, configPath }: { service: Service; configPath: ConfigPath }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return <DropdownMenuItem onSelect={() => dialog.serviceConfigFile.open({ service, configPath })}>{translateText('Edit')} {configPath.name}</DropdownMenuItem>;
}
