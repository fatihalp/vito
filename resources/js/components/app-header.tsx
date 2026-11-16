import { useTranslate } from '@/hooks/use-translate';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ProjectSwitch } from '@/components/project-switch';
import { MailIcon, SlashIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import { ServerSwitch } from '@/components/server-switch';
import { SiteSwitch } from '@/components/site-switch';
import { Link, usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type SocketStatus } from '@/hooks/use-socket-events';
import { SiteHeaderNav } from '@/components/site-header-nav';

export function AppHeader({
  socketStatus,
  socketReconnect,
}: {
  socketStatus: SocketStatus;
  socketReconnect: () => void;
}) {
  const translateText = useTranslate();
  const page = usePage<SharedData>();

  return (
    <header className="bg-sidebar -ml-1 flex shrink-0 flex-col md:-ml-2">
      <div className="flex h-12 items-center justify-between gap-2 border-b px-4">
        <div className="flex min-w-0 items-center gap-1">
          <SidebarTrigger className="-ml-1 md:hidden" aria-label={translateText("Toggle navigation")} aria-controls="app-navigation" />
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <ProjectSwitch />
            <SlashIcon className="text-muted-foreground size-3 shrink-0" />
            <ServerSwitch />
            <SlashIcon className="text-muted-foreground size-3 shrink-0" />
            <SiteSwitch />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {page.props.auth.pendingInvitationsCount > 0 && (
            <Button variant="outline" size="sm" asChild className="border-primary/40 text-primary">
              <Link href={`${"/settings/projects"}#invitations`}>
                <MailIcon className="size-4" />
                <span className="hidden sm:inline">
                  {page.props.auth.pendingInvitationsCount} {page.props.auth.pendingInvitationsCount === 1 ? translateText("invitation") : translateText("invitations")}
                </span>
                <span className="sm:hidden">{page.props.auth.pendingInvitationsCount}</span>
              </Link>
            </Button>
          )}
          {socketStatus !== 'connected' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={socketReconnect}
                  disabled={socketStatus === 'connecting'}
                  aria-label={socketStatus === 'connecting' ? translateText("Connecting to WebSocket") : translateText("WebSocket disconnected, click to reconnect")}
                >
                  {socketStatus === 'connecting' ? <WifiIcon className="size-4 animate-pulse" /> : <WifiOffIcon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {socketStatus === 'connecting' ? translateText("Connecting to WebSocket...") : translateText("WebSocket connection failed. Click to retry.")}
              </TooltipContent>
            </Tooltip>
          )}

        </div>
      </div>
      <SiteHeaderNav />
    </header>
  );
}
