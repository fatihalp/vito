import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Action } from '@/pages/services/components/action';
import { ResyncStats } from '@/pages/services/components/resync-stats';
import Uninstall from '@/pages/services/components/uninstall';
import Networking from '@/pages/services/components/networking';
import ConfigFile from '@/pages/services/components/config-file';
import InstallationLog from '@/pages/services/components/installation-log';
import { Service } from '@/types/service';
import { useDialog } from '@/hooks/use-dialog';

export default function ServiceActions({ service }: { service: Service }) {
  const dialog = useDialog();
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <Action type="start" service={service} />
          <Action type="stop" service={service} />
          <Action type="restart" service={service} />
          <Action type="reload" service={service} />
          <Action type="enable" service={service} />
          <Action type="disable" service={service} />
          {service.supports_networking && (
            <>
              <DropdownMenuSeparator />
              <Networking service={service} />
            </>
          )}
          {service.type === 'log_analysis' && (
            <>
              <DropdownMenuSeparator />
              <ResyncStats service={service} />
            </>
          )}
          {service.config_paths && service.config_paths.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {service.config_paths.map((configPath) => (
                <ConfigFile key={configPath.name} service={service} configPath={configPath} />
              ))}
            </>
          )}
          {service.type === 'php' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => dialog.phpExtensions.open({ service })}>
                Extensions
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => dialog.phpIni.open({ service, type: 'fpm' })}>
                Edit FPM ini
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => dialog.phpIni.open({ service, type: 'cli' })}>
                Edit CLI ini
              </DropdownMenuItem>
              {!service.is_default && (
                <DropdownMenuItem
                  onSelect={() =>
                    dialog.confirm.open({
                      title: 'Make default CLI',
                      description: `Are you sure you want to make PHP ${service.version} the default CLI?`,
                      confirmLabel: 'Save',
                      method: 'post',
                      url: route('php.default-cli', { server: service.server_id, service: service.id }),
                      data: { version: service.version },
                    })
                  }
                >
                  Make default CLI
                </DropdownMenuItem>
              )}
            </>
          )}
          {service.log && (
            <>
              <DropdownMenuSeparator />
              <InstallationLog service={service} />
            </>
          )}
          <DropdownMenuSeparator />
          <Uninstall service={service} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
