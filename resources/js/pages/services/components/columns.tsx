import { ColumnDef } from '@tanstack/react-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVerticalIcon } from 'lucide-react';
import { Service } from '@/types/service';
import { Badge } from '@/components/ui/badge';
import DateTime from '@/components/date-time';
import Uninstall from '@/pages/services/components/uninstall';
import { Action } from '@/pages/services/components/action';
import Version from './version';
import ConfigFile from './config-file';
import InstallationLog from './installation-log';

function ServiceActions({ service }: { service: Service }) {
  return (
    <div className="flex items-center justify-end">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreVerticalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Action type="start" service={service} />
          <Action type="stop" service={service} />
          <Action type="restart" service={service} />
          <Action type="reload" service={service} />
          <Action type="enable" service={service} />
          <Action type="disable" service={service} />
          {service.config_paths && service.config_paths.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {service.config_paths.map((configPath) => (
                <ConfigFile key={configPath.name} service={service} configPath={configPath} />
              ))}
            </>
          )}
          {service.log && (
            <>
              <DropdownMenuSeparator />
              <InstallationLog service={service} />
            </>
          )}
          {!service.is_vito_service && (
            <>
              <DropdownMenuSeparator />
              <Uninstall service={service} />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const columns: ColumnDef<Service>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <span>{row.original.name}</span>
          {row.original.is_vito_service && <Badge variant="info">vito</Badge>}
        </div>
      );
    },
  },
  {
    accessorKey: 'version',
    header: 'Version',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <Version service={row.original} />;
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Installed at',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <DateTime date={row.original.created_at} />;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return (
        <div className="min-w-24">
          <Badge variant={row.original.status_color}>{row.original.status}</Badge>
        </div>
      );
    },
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      return <ServiceActions service={row.original} />;
    },
  },
];
