import Container from '@/components/container';
import ServerBanners from '@/components/server-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import siteHelper from '@/lib/site-helper';
import MetricsCards from '@/pages/monitoring/components/metrics-cards';
import { SharedData } from '@/types';
import type { Server } from '@/types/server';
import { Link, usePage } from '@inertiajs/react';
import { ExternalLinkIcon, GlobeIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';
import { RecentSitesSkeleton } from '@/components/page-skeleton';

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
    <Container className="space-y-5">
      <ServerBanners server={server} />

      <MetricsCards server={server} />


      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3">
          <CardTitle className="text-sm font-semibold">Recent sites</CardTitle>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" asChild>
            <Link href={`/servers/${server.id}/sites`}>All</Link>
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
                  className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 transition-colors"
                >
                  <Link
                    href={`/servers/${server.id}/sites/${site.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                    prefetch
                  >
                    <span className="truncate text-sm font-medium">{site.domain}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={site.status_color} className="text-[10px] px-1.5 py-0">{site.status}</Badge>
                    {[
                      { label: 'Deployments', path: 'deployments' },
                      { label: 'Resources', path: 'resources' },
                      { label: 'Workers', path: 'workers' },
                    ].map((shortcut) => (
                      <Button key={shortcut.path} variant="ghost" size="sm" asChild>
                        <Link href={`/servers/${server.id}/sites/${site.id}/${shortcut.path}`} aria-label={`${site.domain}: ${shortcut.label}`} prefetch>
                          {shortcut.label}
                        </Link>
                      </Button>
                    ))}
                    <a
                      href={site.domain.includes('.') ? `https://${site.domain}` : '/'}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${site.domain}`}
                      className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </a>

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
              {!server.is_self && (
                <div className="pt-2">
                  <Button size="sm" className="gap-1.5 cursor-pointer" asChild>
                    <Link href={`/servers/${server.id}/sites/create`}>
                      <PlusIcon className="size-3.5" />
                      Create site
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
