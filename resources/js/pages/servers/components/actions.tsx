import { Server } from '@/types/server';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, MoreVerticalIcon, PowerOffIcon, PlayIcon, RefreshCwIcon } from 'lucide-react';
import { Link, useForm } from '@inertiajs/react';
import { useDialog } from '@/hooks/use-dialog';

function CheckForUpdates({ server }: { server: Server }) {
  const form = useForm();

  const submit = () => {
    form.post(route('servers.check-for-updates', server.id));
  };

  return (
    <DropdownMenuItem
      className="w-48"
      onSelect={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {form.processing && <LoaderCircleIcon className="size-4 animate-spin" />}
      Check for updates
    </DropdownMenuItem>
  );
}

function CheckConnection({ server }: { server: Server }) {
  const form = useForm();

  const submit = () => {
    form.patch(route('servers.status', server.id));
  };

  return (
    <DropdownMenuItem
      className="w-48"
      onSelect={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {form.processing && <LoaderCircleIcon className="size-4 animate-spin" />}
      Check connection
    </DropdownMenuItem>
  );
}

interface ServerActionsProps {
  server: Server;
  variant?: 'outline' | 'ghost' | 'secondary' | 'default';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
}

export default function ServerActions({
  server,
  variant = 'outline',
  size = 'sm',
  className,
}: ServerActionsProps) {
  const dialog = useDialog();
  const canPowerManage = server.can_power_manage === true;
  const isDisconnected = server.status === 'disconnected';

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className ?? 'gap-1 cursor-pointer'}>
          <MoreVerticalIcon className="size-3 text-muted-foreground" />
          <span>Server actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <CheckConnection server={server} />

        {canPowerManage && isDisconnected && (
          <DropdownMenuItem
            className="text-success focus:text-success focus:bg-success/10 font-medium"
            onSelect={() =>
              dialog.confirm.open({
                title: `Start ${server.name}?`,
                description: `Power on this server via ${server.provider}? The server will boot up and reconnect.`,
                variant: 'default',
                confirmLabel: 'Start Server',
                method: 'post',
                url: route('servers.start', server.id),
              })
            }
          >
            <PlayIcon className="size-4 mr-2 text-success" />
            Start server ({server.provider})
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href={route('servers.restart', { server: server.id, start: 1 })} className="flex items-center w-full cursor-pointer">
            <RefreshCwIcon className="size-4 mr-2" />
            Restart
          </Link>
        </DropdownMenuItem>

        {canPowerManage && !isDisconnected && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10 font-medium"
            onSelect={() =>
              dialog.confirm.open({
                title: `Stop ${server.name}?`,
                description: `Are you sure you want to stop (power off) this server via ${server.provider}? All services, databases, and sites hosted on this server will become offline immediately until you start it again.`,
                variant: 'destructive',
                confirmLabel: 'Stop Server',
                method: 'post',
                url: route('servers.stop', server.id),
              })
            }
          >
            <PowerOffIcon className="size-4 mr-2 text-destructive" />
            Stop server ({server.provider})
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <CheckForUpdates server={server} />
        <DropdownMenuItem
          disabled={server.updates == 0 || server.status === 'updating'}
          asChild
        >
          <Link href={route('servers.update', { server: server.id, start: 1 })} className="flex items-center w-full cursor-pointer">
            Update packages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={server.kernel_updates == 0 || server.status === 'updating'}
          asChild
        >
          <Link href={route('servers.update', { server: server.id, type: 'kernel', start: 1 })} className="flex items-center w-full cursor-pointer">
            Update kernel
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
