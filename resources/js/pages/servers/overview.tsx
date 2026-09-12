import Container from '@/components/container';
import ServerBanners from '@/components/server-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import siteHelper from '@/lib/site-helper';
import MetricsCards from '@/pages/monitoring/components/metrics-cards';
import ServerSetupGuide from '@/pages/servers/components/server-setup-guide';
import CreateSite from '@/pages/sites/components/create-site';
import { SharedData } from '@/types';
import type { Server } from '@/types/server';
import type { SecurityScore } from '@/types/security';
import { Link, router, usePage } from '@inertiajs/react';
import { ArrowRightIcon, ExternalLinkIcon, GlobeIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSocketListener } from '@/hooks/use-socket-events';
import { type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';
import { RecentSitesSkeleton } from '@/components/page-skeleton';

export default function ServerOverview({ securityScore }: { securityScore?: SecurityScore }) {
  const page = usePage<SharedData & { server: Server }>();
  const server = useRealtimeRecord<Server>(page.props.server, 'server')!;
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useSocketListener(
    useCallback(
      (event) => {
        const data = event.data;
        const isObject = !!data && typeof data === 'object' && !Array.isArray(data);
        if (
          (event.type === 'security.updated' || event.type?.startsWith('service.')) &&
          isObject &&
          (data as { server_id?: number }).server_id === server.id
        ) {
          router.reload({ only: ['securityScore'] });
        }
      },
      [server.id],
    ),
  );

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
    <Container className="max-w-5xl space-y-5">
      <ServerBanners server={server} />

      <MetricsCards server={server} />

      <ServerSetupGuide server={server} securityScore={securityScore} />

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
              <div className="pt-2">
                <CreateSite server={server}>
                  <Button size="sm" className="gap-1.5 cursor-pointer">
                    <PlusIcon className="size-3.5" />
                    Create site
                  </Button>
                </CreateSite>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
