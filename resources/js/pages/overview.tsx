import { useTranslate } from '@/hooks/use-translate';
import { withQuery } from '@/lib/url';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import siteHelper from '@/lib/site-helper';
import serverHelper from '@/lib/server-helper';
import { SERVER_NAV_PAGES } from '@/lib/server-nav-pages';
import Layout from '@/layouts/app/layout';
import { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowRightIcon,
  BoxIcon,
  GlobeIcon,
  LayersIcon,
  LayoutGridIcon,
  ListEndIcon,
  type LucideIcon,
  UnplugIcon,
  Settings2Icon,
  TerminalIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { type OverviewServer, type OverviewSite, useOverviewResources } from '@/hooks/use-overview-resources';

function issueCount(status: string, statusColor: string, warnings: unknown[] | undefined): number {
  const warningCount = warnings?.length ?? 0;
  return warningCount > 0 || statusColor === 'danger' || status === 'disconnected' ? Math.max(warningCount, 1) : 0;
}

function IssueIndicator({ count, status }: { count: number; status: string }) {
  if (count === 0) {
    return null;
  }

  const label = status === 'disconnected' ? 'Disconnected' : `${count} important ${count === 1 ? 'issue' : 'issues'}`;
  const StatusIcon = status === 'disconnected' ? UnplugIcon : TriangleAlertIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} role="img" aria-label={label} className="relative z-10 flex size-7 items-center justify-center rounded-md text-warning focus-visible:outline-2 focus-visible:outline-ring">
          <StatusIcon className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type QuickLink = { key: string; label: string; href: string; icon: LucideIcon };

function serverQuickLinks(server: OverviewServer, userId: number): QuickLink[] {
  const keys = serverHelper.getRecentVisitedServerPages(userId, server.id, 2);

  return (keys.length ? keys : ['Sites', 'Services'])
    .map((key): QuickLink | null => {
      const page = SERVER_NAV_PAGES.find((candidate) => candidate.key === key);
      return page ? { key, label: page.label, href: `/servers/${server.id}${page.path}`, icon: page.icon } : null;
    })
    .filter((link): link is QuickLink => link !== null);
}

const SITE_PAGE_META: Record<string, { label: string; path: string; icon: LucideIcon }> = {
  Application: { label: 'Application', path: '', icon: LayoutGridIcon },
  Topology: { label: 'Topology', path: '/topology', icon: LayersIcon },
  Resources: { label: 'Resources', path: '/resources', icon: BoxIcon },
  Domains: { label: 'Domains', path: '/domains', icon: GlobeIcon },
  Commands: { label: 'Commands', path: '/commands', icon: TerminalIcon },
  Workers: { label: 'Workers', path: '/workers', icon: ListEndIcon },
  Settings: { label: 'Settings', path: '/settings', icon: Settings2Icon },
};

function siteQuickLinks(site: OverviewSite, userId: number): QuickLink[] {

  const keys = siteHelper.getRecentVisitedSitePages(userId, site.id, 2);

  return (keys.length ? keys : ['Commands', 'Workers'])
    .map((key): QuickLink | null => {
      const meta = SITE_PAGE_META[key];
      return meta ? { key, label: meta.label, href: `/servers/${site.server_id}/sites/${site.id}${meta.path}`, icon: meta.icon } : null;
    })
    .filter((link): link is QuickLink => link !== null);
}

function ResourceRow({
  href,
  title,
  subtitle,
  right,
  quickLinks,
}: {
  href: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  quickLinks?: QuickLink[];
}) {
  if (!quickLinks || quickLinks.length === 0) {
    return (
      <Link href={href} className="w-full text-left hover:bg-muted/50 flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors" prefetch>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="break-words text-sm font-medium">{title}</span>
            {subtitle && <span className="text-muted-foreground break-words text-xs">{subtitle}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          <ArrowRightIcon className="text-muted-foreground size-3.5" />
        </div>
      </Link>
    );
  }

  return (
    <div className="hover:bg-muted/50 group relative flex items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors">
      <Link href={href} className="absolute inset-0" aria-label={title} prefetch />
      <div className="pointer-events-none flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words text-sm font-medium">{title}</span>
          {subtitle && <span className="text-muted-foreground break-words text-xs">{subtitle}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {quickLinks.map((link) => (
            <Tooltip key={link.key}>
              <TooltipTrigger asChild>
                <Link
                  href={link.href}
                  aria-label={link.label}
                  className="hover:bg-background text-muted-foreground hover:text-foreground relative z-10 flex size-6 items-center justify-center rounded-md transition-colors"
                >
                  <link.icon className="size-3.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>{link.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        {right}
        <ArrowRightIcon className="text-muted-foreground size-3.5" />
      </div>
    </div>
  );
}

function QuickAccessCard({
  title,
  viewAllHref,
  emptyText,
  loading,
  count,
  children,
}: {
  title: string;
  viewAllHref: string;
  emptyText: string;
  loading: boolean;
  count: number;
  children?: ReactNode;
}) {
  const translateText = useTranslate();
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <Link href={viewAllHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-info hover:underline">
          {translateText('All')} <ArrowRightIcon className="size-4" />
        </Link>
      </div>
      {loading || count === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">{loading ? translateText("Loading…") : emptyText}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/50">{children}</div>
      )}
    </section>
  );
}

function prioritize<T extends { id: number }>(items: T[], ids: number[]): T[] {
  const matched = ids.map((id) => items.find((item) => item.id === id)).filter((item): item is T => item !== undefined);

  return [...matched, ...items.filter((item) => !ids.includes(item.id))];
}

export default function Overview() {
  const translateText = useTranslate();
  const page = usePage<SharedData>();
  const userId = page.props.auth.user.id;
  const [recentServerIds, setRecentServerIds] = useState<number[]>([]);
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setRecentServerIds(serverHelper.getAllRecentServers(userId, 25).map((server) => server.id));
    setRecentSiteIds(siteHelper.getAllRecentSites(userId, 25).map((site) => site.id));
    setHistoryLoaded(true);
  }, [userId]);

  const resources = useOverviewResources(undefined, recentServerIds, recentSiteIds, historyLoaded);
  const { isLoading } = resources;
  const data = resources.data;

  const query = search.trim().toLowerCase();
  const recentServers = prioritize(data?.servers ?? [], recentServerIds)
    .filter((server) => `${server.name} ${server.ip} ${server.status}`.toLowerCase().includes(query)).slice(0, 6);
  const recentSites = prioritize(data?.sites ?? [], recentSiteIds)
    .filter((site) => `${site.domain} ${site.server_name} ${site.status}`.toLowerCase().includes(query)).slice(0, 6);

  return (
    <Layout>
      <Head title={translateText('Overview')} />
      <Container>
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <Heading title={translateText('Overview')} />
          <Input
            type="search"
            aria-label={translateText("Search servers and sites")}
            placeholder={translateText("Filter recent resources")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full sm:max-w-xs"
          />
        </div>

        <div className="grid items-start gap-3 md:grid-cols-2">
              <QuickAccessCard
                title={translateText('Servers')}
                viewAllHref={"/servers"}
                emptyText={query ? 'No matching servers.' : 'No servers yet.'}
                loading={isLoading}
                count={recentServers.length}
              >
                {recentServers.map((server) => (
                  <ResourceRow
                    key={server.id}
                    href={`/servers/${server.id}`}
                    title={server.name}
                    subtitle={<><span className="font-mono">{server.ip}</span>{server.status !== 'ready' && server.status !== 'disconnected' && <span className="block text-muted-foreground">{server.status}</span>}</>}
                    quickLinks={serverQuickLinks(server, userId)}
                    right={
                      <>
                        <IssueIndicator status={server.status} count={issueCount(server.status, server.status_color, server.warnings)} />
                      </>
                    }
                  />
                ))}
              </QuickAccessCard>

              <QuickAccessCard
                title={translateText('Sites')}
                viewAllHref={withQuery("/sites", { project: 'all' })}
                emptyText={query ? 'No matching sites.' : 'No sites yet.'}
                loading={isLoading}
                count={recentSites.length}
              >
                {recentSites.map((site) => (
                  <ResourceRow
                    key={site.id}
                    href={`/servers/${site.server_id}/sites/${site.id}`}
                    title={site.domain}
                    subtitle={<>{site.server_name}{site.status !== 'ready' && site.status !== 'disconnected' && <span className="block text-muted-foreground">{site.status}</span>}</>}
                    quickLinks={siteQuickLinks(site, userId)}
                    right={
                      <>
                        <IssueIndicator status={site.status} count={issueCount(site.status, site.status_color, site.warnings)} />
                      </>
                    }
                  />
                ))}
              </QuickAccessCard>



        </div>
      </Container>
    </Layout>
  );
}
