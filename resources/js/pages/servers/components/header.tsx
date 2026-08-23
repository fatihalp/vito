import { Server } from '@/types/server';
import { CheckIcon, CloudIcon, KeyRoundIcon, LoaderCircleIcon, SlashIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { StatusRipple } from '@/components/status-ripple';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ConnectSshDialog from './connect-ssh-dialog';

export default function ServerHeader({ server: initialServer }: { server: Server }) {
  const server = useRealtimeRecord<Server>(initialServer, 'server')!;

  useEffect(() => {
    if (initialServer.status === 'installing' && (server.status === 'ready' || server.status === 'installation_failed')) {
      router.reload();
    }
  }, [server.status, initialServer.status]);

  const statusForm = useForm();

  const checkStatus = () => {
    if (['installing', 'installation_failed'].includes(server.status)) {
      return;
    }

    statusForm.patch(route('servers.status', { server: server.id }));
  };

  const [ipCopied, setIpCopied] = useState(false);
  const copyIp = (ip: string) => {
    navigator.clipboard.writeText(ip).then(() => {
      setIpCopied(true);
      setTimeout(() => {
        setIpCopied(false);
      }, 2000);
    });
  };

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center space-x-2 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center space-x-1">
              <CloudIcon className="size-4" />
              <div className="hidden lg:inline-flex">{server.provider}</div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div>
              <span className="lg:hidden">{server.provider}</span>
              <span className="hidden lg:inline-flex">Server Provider</span>
            </div>
          </TooltipContent>
        </Tooltip>
        <SlashIcon className="size-3" />
        <Badge variant={server.role_color}>{server.role}</Badge>
        <SlashIcon className="size-3" />
        <Tooltip>
          <TooltipTrigger asChild>
            {ipCopied ? (
              <CheckIcon className="text-success size-3" />
            ) : (
              <div>
                {statusForm.processing && <LoaderCircleIcon className="size-3 animate-spin" />}
                {!statusForm.processing && <StatusRipple className="cursor-pointer" onClick={checkStatus} variant={server.status_color} />}
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{server.status}</span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-pointer lg:inline-flex" onClick={() => copyIp(server.ip)}>
              {server.ip}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>Server IP</span>
          </TooltipContent>
        </Tooltip>
        {['installing', 'installation_failed'].includes(server.status) && (
          <>
            <SlashIcon className="size-3" />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-1">
                  <LoaderCircleIcon className={cn('size-4', server.status === 'installing' ? 'text-brand animate-spin' : '')} />
                  <div>{parseInt(server.progress || '0')}%</div>
                  {server.status === 'installation_failed' && (
                    <Badge className="ml-1" variant={server.status_color}>
                      {server.status}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">Status</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <ConnectSshDialog server={server}>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground">
            <KeyRoundIcon className="size-3" />
            <span>Connect</span>
          </Button>
        </ConnectSshDialog>
      </div>
    </div>
  );
}
