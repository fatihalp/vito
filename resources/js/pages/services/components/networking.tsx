import { Service } from '@/types/service';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';

export default function Networking({ service }: { service: Service }) {
  const dialog = useDialog();
  const isRemoteOpen = service.networking_enabled;

  return (
    <>
      <DropdownMenuItem
        onSelect={() =>
          dialog.confirm.open({
            title: isRemoteOpen ? 'Close Remote Access' : 'Open to Remote (Remote Connection)',
            description: isRemoteOpen
              ? `Are you sure you want to disable remote access for ${service.name}? The service will be limited to local connections only (127.0.0.1).`
              : `Are you sure you want to open ${service.name} to remote connections (0.0.0.0)?`,
            variant: isRemoteOpen ? 'destructive' : 'default',
            confirmLabel: isRemoteOpen ? 'Make Local Only' : 'Open to Remote',
            method: 'post',
            url: route(
              isRemoteOpen ? 'services.networking.disable' : 'services.networking.enable',
              { server: service.server_id, service: service.id }
            ),
          })
        }
      >
        {isRemoteOpen ? 'Close Remote Access' : 'Open to Remote'}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => dialog.serviceNetworking.open({ service })}>
        Networking Settings
      </DropdownMenuItem>
    </>
  );
}
