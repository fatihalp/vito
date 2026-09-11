import Container from '@/components/container';
import ServerBanners from '@/components/server-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import siteHelper from '@/lib/site-helper';
import MetricsCards from '@/pages/monitoring/components/metrics-cards';
import ServerActions from '@/pages/servers/components/actions';
import { InstantLogs } from '@/pages/server-logs/components/instant-logs';
import { SharedData } from '@/types';
import type { Server } from '@/types/server';
import { Link, useForm, usePage } from '@inertiajs/react';
import { ArrowRightIcon, ExternalLinkIcon, GlobeIcon, LoaderCircleIcon, LogsIcon, RefreshCwIcon, TerminalSquareIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';
import { RecentSitesSkeleton } from '@/components/page-skeleton';

function CheckConnectionButton({ serverId }: { serverId: number }) {
  const form = useForm();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={form.processing}
      onClick={() => form.patch(route('servers.status', serverId))}
    >
      {form.processing ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
      Check connection
    </Button>
  );
}

export default function ServerOverview() {
  const page = usePage<SharedData & { server: Server }>();
  const server = useRealtimeRecord<Server>(page.props.server, 'server')!;
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    setRecentSiteIds(siteHelper.getRecentSites(page.props.auth.user.id, server.id, 25).map((site) => site.id));
    setHistoryLoaded(true);
  }, [page.props.auth.user.id, server.id]);

  const resources = useOverviewResources(server.project_id, [], recentSiteIds, historyLoaded, server.id);
  const sites = resources.data?.sites ?? [];

  const matchedRecentSites = recentSiteIds
    .map((id) => sites.find((site) => site.id === id && site.server_id === server.id))
    .filter((site): site is OverviewSite => site !== undefined)
    .slice(0, 5);
  const recentSites = matchedRecentSites.length > 0 ? matchedRecentSites : sites.slice(0, 5);

  const isOffline = server.status === 'disconnected';

  return (
    <Container className="max-w-5xl space-y-5">
      <ServerBanners server={server} />

      <div className="flex flex-wrap items-center gap-2">
        {isOffline ? (
          <>
            <CheckConnectionButton serverId={server.id} />
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href={route('servers.restart', { server: server.id, start: 1 })}>
                <RefreshCwIcon className="size-3.5" />
                Restart
              </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-60">
                    <TerminalSquareIcon className="size-4" />
                    Terminal
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Server is offline</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-60">
                    <LogsIcon className="size-4" />
                    Logs
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Server is offline</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const url = route('console', { server: server.id });
                window.open(url, `terminal-${server.id}`, 'width=900,height=600,menubar=no,toolbar=no,location=no,status=no');
              }}
            >
              <TerminalSquareIcon className="size-4" />
              Terminal
            </Button>
            <InstantLogs server={server}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <LogsIcon className="size-4" />
                Logs
              </Button>
            </InstantLogs>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href={route('servers.restart', { server: server.id, start: 1 })}>
                <RefreshCwIcon className="size-3.5" />
                Restart
              </Link>
            </Button>
          </>
        )}
        <ServerActions server={server} />
      </div>

      <MetricsCards server={server} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3">
          <CardTitle className="text-sm font-semibold">Recent sites</CardTitle>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" asChild>
            <Link href={route('sites', { server: server.id })}>All</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {resources.isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="text-destructive text-sm">Recent sites could not be loaded.</span>
              <Button variant="outline" size="sm" onClick={() => void resources.refetch()}>
                Retry
              </Button>
            </div>
          ) : resources.isLoading ? (
            <RecentSitesSkeleton />
          ) : recentSites.length > 0 ? (
            <div className="divide-y">
              {recentSites.map((site) => (
                <div
                  key={site.id}
                  className="hover:bg-muted/50 flex items-center justify-between gap-4 px-4 py-2.5 transition-colors"
                >
                  <Link
                    href={route('application', { server: server.id, site: site.id })}
                    className="flex min-w-0 flex-1 items-center gap-3"
                    prefetch
                  >
                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <GlobeIcon className="text-muted-foreground size-4" />
                    </div>
                    <span className="truncate text-sm font-medium">{site.domain}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={site.status_color} className="text-[10px] px-1.5 py-0">{site.status}</Badge>
                    <a
                      href={`https://${site.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${site.domain}`}
                      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </a>
                    <Link
                      href={route('application', { server: server.id, site: site.id })}
                      className="text-muted-foreground hover:text-foreground"
                      prefetch
                    >
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <GlobeIcon className="text-muted-foreground size-5" />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium">No recent sites</h3>
                <p className="text-muted-foreground text-xs">Sites you open on this server will appear here.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
