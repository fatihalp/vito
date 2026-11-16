import { useTranslate } from '@/hooks/use-translate';
import { Server } from '@/types/server';
import { CheckIcon, CloudIcon, KeyRoundIcon, LoaderCircleIcon, SlashIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { StatusRipple } from '@/components/status-ripple';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, router, useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { useClipboard } from '@/hooks/use-clipboard';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ConnectSshDialog from './connect-ssh-dialog';
import ServerActions from './actions';

export default function ServerHeader({ server: initialServer }: { server: Server }) {
  const translateText = useTranslate();
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

    statusForm.patch(`/servers/${server.id}/status`);
  };

  const { copied: ipCopied, copy: copyIp } = useClipboard();

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs">
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
              <span className="hidden lg:inline-flex">{translateText("Server Provider")}</span>
            </div>
          </TooltipContent>
        </Tooltip>
        <SlashIcon className="size-3" />
        <span className="text-muted-foreground whitespace-nowrap">{server.role}</span>

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
            <button type="button" className="cursor-pointer lg:inline-flex" onClick={() => copyIp(server.ip)} aria-label={translateText("Copy server IP")}>
              {server.ip}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>{translateText("Server IP")}</span>
          </TooltipContent>
        </Tooltip>
        {!['installing', 'installation_failed'].includes(server.status) && (
          <ServerActions
            server={server}
            variant="outline"
            className="h-6 text-[11px] gap-1 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
          />
        )}
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
              <TooltipContent side="bottom">{translateText('Status')}</TooltipContent>
            </Tooltip>
          </>
        )}
        {server.status === 'updating' && (
          <>
            <SlashIcon className="size-3" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" asChild className="h-6 gap-1 px-1.5 text-xs text-neutral-500 hover:text-neutral-600 dark:text-neutral-400 cursor-pointer">
                  <Link href={`/servers/${server.id}/update`}>
                    <LoaderCircleIcon className="size-3 animate-spin" />
                    <span>{translateText("Updating...")}</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{translateText("Package update in progress. Click to view console logs.")}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <ConnectSshDialog server={server}>
          <Button aria-label={translateText("Connect via SSH")} variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground cursor-pointer">
            <KeyRoundIcon className="size-3" />
            <span className="hidden sm:inline">{translateText('Connect')}</span>
          </Button>
        </ConnectSshDialog>
      </div>
    </div>
  );
}
