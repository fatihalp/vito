import Container from '@/components/container';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import siteHelper from '@/lib/site-helper';
import serverHelper from '@/lib/server-helper';
import Layout from '@/layouts/app/layout';
import { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRightIcon, GlobeIcon, ServerIcon, TriangleAlertIcon } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { type OverviewServer, type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';

function issueCount(status: string, statusColor: string, warnings: unknown[] | undefined): number {
  const warningCount = warnings?.length ?? 0;

  return warningCount > 0 || statusColor === 'danger' || status === 'disconnected' ? Math.max(warningCount, 1) : 0;
}

function IssueIndicator({ count }: { count: number }) {
  if (count === 0) {
    return null;
  }

  return (
    <span
      className="bg-warning/15 text-warning border-warning/40 flex size-7 items-center justify-center rounded-md border"
      role="img"
      aria-label={`${count} important ${count === 1 ? 'issue' : 'issues'}`}
    >
      <TriangleAlertIcon className="size-4" />
    </span>
  );
}

function QuickAccessCard({
  title,
  description,
  viewAllHref,
  emptyText,
  children,
}: {
  title: string;
  description: string;
  viewAllHref: string;
  emptyText: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={viewAllHref}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {children ?? <div className="text-muted-foreground py-10 text-center text-sm">{emptyText}</div>}
      </CardContent>
    </Card>
  );
}

function RecentServers({ servers }: { servers: OverviewServer[] }) {
  if (servers.length === 0) {
    return null;
  }

  return (
    <div className="divide-y">
      {servers.map((server) => (
        <Link
          key={server.id}
          href={route('servers.show', { server: server.id })}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3 py-3 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <ServerIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{server.name}</span>
              <span className="text-muted-foreground truncate text-xs">{server.ip}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IssueIndicator count={issueCount(server.status, server.status_color, server.warnings)} />
            <Badge variant={server.status_color}>{server.status}</Badge>
            <ArrowRightIcon className="text-muted-foreground size-4" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentSites({ sites }: { sites: OverviewSite[] }) {
  if (sites.length === 0) {
    return null;
  }

  return (
    <div className="divide-y">
      {sites.map((site) => (
        <Link
          key={site.id}
          href={route('application', { server: site.server_id, site: site.id })}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3 py-3 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <GlobeIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{site.domain}</span>
              <span className="text-muted-foreground truncate text-xs">{site.server_name}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IssueIndicator count={issueCount(site.status, site.status_color, site.warnings)} />
            <Badge variant={site.status_color}>{site.status}</Badge>
            <ArrowRightIcon className="text-muted-foreground size-4" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Overview() {
  const page = usePage<SharedData>();
  const project = page.props.auth.currentProject;
  const [recentServerIds, setRecentServerIds] = useState<number[]>([]);
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (!project) {
      setRecentServerIds([]);
      setRecentSiteIds([]);
      setHistoryLoaded(true);
      return;
    }

    setRecentServerIds(serverHelper.getRecentServers(page.props.auth.user.id, project.id, 25).map((server) => server.id));
    setRecentSiteIds(siteHelper.getRecentProjectSites(page.props.auth.user.id, project.id, 25).map((site) => site.id));
    setHistoryLoaded(true);
  }, [page.props.auth.user.id, project]);

  const resources = useOverviewResources(project?.id, recentServerIds, recentSiteIds, historyLoaded);
  const servers = resources.data?.servers ?? [];
  const sites = resources.data?.sites ?? [];

  const recentServers = recentServerIds
    .map((id) => servers.find((server) => server.id === id))
    .filter((server): server is OverviewServer => server !== undefined)
    .slice(0, 3);
  const recentSites = recentSiteIds
    .map((id) => sites.find((site) => site.id === id))
    .filter((site): site is OverviewSite => site !== undefined)
    .slice(0, 3);

  return (
    <Layout>
      <Head title="Overview" />
      <Container className="max-w-6xl">
        <Heading title={project?.name ?? 'Overview'} description="Quick access to the resources you recently used in this project." />
        <div className="grid gap-6 lg:grid-cols-2">
            <QuickAccessCard
              title="Recent servers"
              description="The last 3 servers you opened."
              viewAllHref={route('servers')}
              emptyText="Servers you open in this project will appear here."
            >
              {resources.isError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-destructive text-sm">Recent servers could not be loaded.</span>
                  <Button variant="outline" size="sm" onClick={() => void resources.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : resources.isLoading ? (
                <div className="text-muted-foreground py-10 text-center text-sm">Loading recent servers...</div>
              ) : recentServers.length > 0 ? (
                <RecentServers servers={recentServers} />
              ) : undefined}
            </QuickAccessCard>
            <QuickAccessCard
              title="Recent sites"
              description="The last 3 sites you opened."
              viewAllHref={route('sites.all', { project: project?.id ?? 'all' })}
              emptyText="Sites you open in this project will appear here."
            >
              {resources.isError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-destructive text-sm">Recent sites could not be loaded.</span>
                  <Button variant="outline" size="sm" onClick={() => void resources.refetch()}>
                    Retry
                  </Button>
                </div>
              ) : resources.isLoading ? (
                <div className="text-muted-foreground py-10 text-center text-sm">Loading recent sites...</div>
              ) : recentSites.length > 0 ? (
                <RecentSites sites={recentSites} />
              ) : undefined}
            </QuickAccessCard>
        </div>
      </Container>
    </Layout>
  );
}
