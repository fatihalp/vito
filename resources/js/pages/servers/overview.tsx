import Container from '@/components/container';
import ServerBanners from '@/components/server-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import siteHelper from '@/lib/site-helper';
import MetricsCards from '@/pages/monitoring/components/metrics-cards';
import ServerActions from '@/pages/servers/components/actions';
import ConnectSshDialog from '@/pages/servers/components/connect-ssh-dialog';
import { InstantLogs } from '@/pages/server-logs/components/instant-logs';
import { SharedData } from '@/types';
import type { Server } from '@/types/server';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRightIcon, GlobeIcon, LogsIcon, TerminalSquareIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';

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

  return (
    <Container className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-2">
        <ConnectSshDialog server={server} />
        <InstantLogs server={server}>
          <Button variant="outline" size="sm">
            <LogsIcon className="size-4" />
            Logs
          </Button>
        </InstantLogs>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = route('console', { server: server.id });
            window.open(url, `terminal-${server.id}`, 'width=900,height=600,menubar=no,toolbar=no,location=no,status=no');
          }}
        >
          <TerminalSquareIcon className="size-4" />
          Terminal
        </Button>
        <ServerActions server={server} />
      </div>

      <ServerBanners server={server} />
      <MetricsCards server={server} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Recent sites</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={route('sites', { server: server.id })}>All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {resources.isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="text-destructive text-sm">Recent sites could not be loaded.</span>
              <Button variant="outline" size="sm" onClick={() => void resources.refetch()}>
                Retry
              </Button>
            </div>
          ) : resources.isLoading ? (
            <div className="text-muted-foreground px-6 py-12 text-center text-sm">Loading recent sites...</div>
          ) : recentSites.length > 0 ? (
            <div className="divide-y">
              {recentSites.map((site) => (
                <Link
                  key={site.id}
                  href={route('application', { server: server.id, site: site.id })}
                  className="hover:bg-muted/50 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
                  prefetch
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <GlobeIcon className="text-muted-foreground size-4" />
                    </div>
                    <span className="truncate font-medium">{site.domain}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={site.status_color}>{site.status}</Badge>
                    <ArrowRightIcon className="text-muted-foreground size-4" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <GlobeIcon className="text-muted-foreground size-6" />
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">No recent sites</h3>
                <p className="text-muted-foreground text-sm">Sites you open on this server will appear here.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
