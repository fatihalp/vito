import Container from '@/components/container';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import siteHelper from '@/lib/site-helper';
import serverHelper from '@/lib/server-helper';
import Layout from '@/layouts/app/layout';
import { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowRightIcon,
  CloudIcon,
  CloudUploadIcon,
  CodeIcon,
  DatabaseIcon,
  FolderGit2Icon,
  GlobeIcon,
  ServerIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import {
  type OverviewBackup,
  type OverviewDomain,
  type OverviewProject,
  type OverviewProviderItem,
  type OverviewServer,
  type OverviewSite,
  useOverviewResources,
} from '@/hooks/use-overview-resources';

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
  viewAllHref,
  emptyText,
  children,
}: {
  title: string;
  viewAllHref: string;
  emptyText: string;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-4 py-3.5 px-4 border-b bg-muted/20">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" asChild>
          <Link href={viewAllHref}>All</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col justify-center">
        {children ?? <div className="text-muted-foreground py-8 text-center text-xs">{emptyText}</div>}
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
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <ServerIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{server.name}</span>
              <span className="text-muted-foreground truncate font-mono text-[11px]">{server.ip}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IssueIndicator count={issueCount(server.status, server.status_color, server.warnings)} />
            <Badge variant={server.status_color} className="text-[10px] px-1.5 py-0">
              {server.status}
            </Badge>
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
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
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <GlobeIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{site.domain}</span>
              <span className="text-muted-foreground truncate text-xs">{site.server_name}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <IssueIndicator count={issueCount(site.status, site.status_color, site.warnings)} />
            <Badge variant={site.status_color} className="text-[10px] px-1.5 py-0">
              {site.status}
            </Badge>
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentProjectsList({ projects }: { projects: OverviewProject[] }) {
  if (projects.length === 0) return null;
  return (
    <div className="divide-y">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={route('projects')}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <FolderGit2Icon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{p.name}</span>
              <span className="text-muted-foreground truncate text-[11px]">
                {p.users_count} {p.users_count === 1 ? 'user' : 'users'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {p.is_current && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Current
              </Badge>
            )}
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentProvidersList({ items, href }: { items: OverviewProviderItem[]; href: string }) {
  if (items.length === 0) return null;
  return (
    <div className="divide-y">
      {items.map((item) => (
        <Link
          key={item.id}
          href={href}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <CloudIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{item.profile || item.username || item.provider}</span>
              <span className="text-muted-foreground truncate text-[11px] capitalize">{item.provider}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={item.connected ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 font-normal">
              {item.connected ? 'Connected' : 'Disconnected'}
            </Badge>
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentBackupsList({ backups }: { backups: OverviewBackup[] }) {
  if (backups.length === 0) return null;
  return (
    <div className="divide-y">
      {backups.map((b) => (
        <Link
          key={b.id}
          href={route('backups.all')}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <CloudUploadIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{b.name}</span>
              <span className="text-muted-foreground truncate text-[11px]">{b.server_name || 'Server'}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {b.schedule && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                {b.schedule}
              </Badge>
            )}
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function RecentDomainsList({ domains }: { domains: OverviewDomain[] }) {
  if (domains.length === 0) return null;
  return (
    <div className="divide-y">
      {domains.map((d) => (
        <Link
          key={d.id}
          href={route('domains')}
          className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors"
          prefetch
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <GlobeIcon className="text-muted-foreground size-4" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium">{d.domain}</span>
              {d.provider_name && <span className="text-muted-foreground truncate text-[11px]">{d.provider_name}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ArrowRightIcon className="text-muted-foreground size-3.5" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Overview() {
  const page = usePage<SharedData>();
  const [recentServerIds, setRecentServerIds] = useState<number[]>([]);
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    const userId = page.props.auth?.user?.id;
    if (!userId) {
      setRecentServerIds([]);
      setRecentSiteIds([]);
      setHistoryLoaded(true);
      return;
    }

    const allServers = serverHelper.getAllRecentServers(userId, 25).map((server) => server.id);
    const allSites = siteHelper.getAllRecentSites(userId, 25).map((site) => site.id);

    setRecentServerIds(allServers);
    setRecentSiteIds(allSites);
    setHistoryLoaded(true);
  }, [page.props.auth?.user?.id]);

  const resources = useOverviewResources(undefined, recentServerIds, recentSiteIds, historyLoaded);
  const servers = resources.data?.servers ?? [];
  const sites = resources.data?.sites ?? [];
  const projects = resources.data?.projects ?? [];
  const serverProviders = resources.data?.server_providers ?? [];
  const sourceControls = resources.data?.source_controls ?? [];
  const storageProviders = resources.data?.storage_providers ?? [];
  const dnsProviders = resources.data?.dns_providers ?? [];
  const backups = resources.data?.backups ?? [];
  const domains = resources.data?.domains ?? [];

  const matchedRecentServers = recentServerIds
    .map((id) => servers.find((server) => server.id === id))
    .filter((server): server is OverviewServer => server !== undefined);
  const otherServers = servers.filter((server) => !recentServerIds.includes(server.id));
  const recentServers = [...matchedRecentServers, ...otherServers].slice(0, 3);

  const matchedRecentSites = recentSiteIds
    .map((id) => sites.find((site) => site.id === id))
    .filter((site): site is OverviewSite => site !== undefined);
  const otherSites = sites.filter((site) => !recentSiteIds.includes(site.id));
  const recentSites = [...matchedRecentSites, ...otherSites].slice(0, 3);

  return (
    <Layout>
      <Head title="Overview" />
      <Container className="max-w-6xl space-y-6">
        <Heading title="Overview" />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Recent servers */}
          <QuickAccessCard title="Recent servers" viewAllHref={route('servers')} emptyText="No servers found.">
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading servers...</div>
            ) : recentServers.length > 0 ? (
              <RecentServers servers={recentServers} />
            ) : undefined}
          </QuickAccessCard>

          {/* Recent sites */}
          <QuickAccessCard
            title="Recent sites"
            viewAllHref={route('sites.all', { project: 'all' })}
            emptyText="No sites found."
          >
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading sites...</div>
            ) : recentSites.length > 0 ? (
              <RecentSites sites={recentSites} />
            ) : undefined}
          </QuickAccessCard>

          {/* Projects */}
          <QuickAccessCard title="Projects" viewAllHref={route('projects')} emptyText="No projects found.">
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading projects...</div>
            ) : projects.length > 0 ? (
              <RecentProjectsList projects={projects} />
            ) : undefined}
          </QuickAccessCard>

          {/* Server Providers */}
          <QuickAccessCard
            title="Server Providers"
            viewAllHref={route('server-providers')}
            emptyText="No server providers configured."
          >
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading server providers...</div>
            ) : serverProviders.length > 0 ? (
              <RecentProvidersList items={serverProviders} href={route('server-providers')} />
            ) : undefined}
          </QuickAccessCard>

          {/* Source Controls */}
          <QuickAccessCard
            title="Source Controls"
            viewAllHref={route('source-controls')}
            emptyText="No source controls configured."
          >
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading source controls...</div>
            ) : sourceControls.length > 0 ? (
              <RecentProvidersList items={sourceControls} href={route('source-controls')} />
            ) : undefined}
          </QuickAccessCard>

          {/* Storage Providers */}
          <QuickAccessCard
            title="Storage Providers"
            viewAllHref={route('storage-providers')}
            emptyText="No storage providers configured."
          >
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading storage providers...</div>
            ) : storageProviders.length > 0 ? (
              <RecentProvidersList items={storageProviders} href={route('storage-providers')} />
            ) : undefined}
          </QuickAccessCard>

          {/* DNS Providers */}
          <QuickAccessCard
            title="DNS Providers"
            viewAllHref={route('dns-providers')}
            emptyText="No DNS providers configured."
          >
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading DNS providers...</div>
            ) : dnsProviders.length > 0 ? (
              <RecentProvidersList items={dnsProviders} href={route('dns-providers')} />
            ) : undefined}
          </QuickAccessCard>

          {/* Backups */}
          <QuickAccessCard title="Backups" viewAllHref={route('backups.all')} emptyText="No backups configured.">
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading backups...</div>
            ) : backups.length > 0 ? (
              <RecentBackupsList backups={backups} />
            ) : undefined}
          </QuickAccessCard>

          {/* Domains */}
          <QuickAccessCard title="Domains" viewAllHref={route('domains')} emptyText="No domains configured.">
            {resources.isLoading ? (
              <div className="text-muted-foreground py-8 text-center text-xs">Loading domains...</div>
            ) : domains.length > 0 ? (
              <RecentDomainsList domains={domains} />
            ) : undefined}
          </QuickAccessCard>
        </div>
      </Container>
    </Layout>
  );
}
