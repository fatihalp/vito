import Container from '@/components/container';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import siteHelper from '@/lib/site-helper';
import serverHelper from '@/lib/server-helper';
import Layout from '@/layouts/app/layout';
import { SharedData } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowRightIcon,
  CloudIcon,
  CloudUploadIcon,
  EyeOffIcon,
  FolderGit2Icon,
  GlobeIcon,
  LayoutGridIcon,
  type LucideIcon,
  ServerIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { type OverviewProviderItem, useOverviewResources } from '@/hooks/use-overview-resources';

const WIDGETS = [
  { key: 'servers', label: 'Recent servers' },
  { key: 'sites', label: 'Recent sites' },
  { key: 'projects', label: 'Projects' },
  { key: 'server_providers', label: 'Server providers' },
  { key: 'source_controls', label: 'Source controls' },
  { key: 'storage_providers', label: 'Storage providers' },
  { key: 'dns_providers', label: 'DNS providers' },
  { key: 'backups', label: 'Backups' },
  { key: 'domains', label: 'Domains' },
] as const;

type WidgetKey = (typeof WIDGETS)[number]['key'];

const allWidgetKeys = WIDGETS.map((widget) => widget.key);

function overviewWidgetsKey(userId: number): string {
  return `overview-widgets:${userId}`;
}

function readEnabledWidgets(userId: number): Set<WidgetKey> {
  if (typeof window === 'undefined') {
    return new Set(allWidgetKeys);
  }

  try {
    const stored = localStorage.getItem(overviewWidgetsKey(userId));

    return stored ? new Set(JSON.parse(stored) as WidgetKey[]) : new Set(allWidgetKeys);
  } catch {
    return new Set(allWidgetKeys);
  }
}

function writeEnabledWidgets(userId: number, widgets: Set<WidgetKey>): void {
  try {
    localStorage.setItem(overviewWidgetsKey(userId), JSON.stringify([...widgets]));
  } catch {
    return;
  }
}

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

function StatusBadge({ status, color }: { status: string; color: 'gray' | 'success' | 'info' | 'warning' | 'danger' }) {
  return (
    <Badge variant={color} className="px-1.5 py-0 text-[10px]">
      {status}
    </Badge>
  );
}

function ResourceRow({
  href,
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Link href={href} className="hover:bg-muted/50 flex items-center justify-between gap-4 px-3.5 py-2.5 transition-colors" prefetch>
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-4" />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{title}</span>
          {subtitle && <span className="text-muted-foreground truncate text-[11px]">{subtitle}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <ArrowRightIcon className="text-muted-foreground size-3.5" />
      </div>
    </Link>
  );
}

function QuickAccessCard({
  title,
  viewAllHref,
  emptyText,
  loading,
  count,
  onHide,
  children,
}: {
  title: string;
  viewAllHref: string;
  emptyText: string;
  loading: boolean;
  count: number;
  onHide: () => void;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-muted/20 flex-row items-center justify-between gap-4 border-b px-4 py-3.5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" asChild>
            <Link href={viewAllHref}>All</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7"
            onClick={onHide}
            aria-label={`Hide ${title}`}
            title={`Hide ${title}`}
          >
            <EyeOffIcon className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center p-0">
        {loading || count === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-xs">{loading ? 'Loading...' : emptyText}</div>
        ) : (
          <div className="divide-y">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderRows({ items, href }: { items: OverviewProviderItem[]; href: string }) {
  return items.map((item) => (
    <ResourceRow
      key={item.id}
      href={href}
      icon={CloudIcon}
      title={item.profile}
      subtitle={<span className="capitalize">{item.provider}</span>}
      right={
        item.connected !== undefined && (
          <Badge variant={item.connected ? 'default' : 'gray'} className="px-1.5 py-0 text-[10px] font-normal">
            {item.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        )
      }
    />
  ));
}

function prioritize<T extends { id: number }>(items: T[], ids: number[]): T[] {
  const matched = ids.map((id) => items.find((item) => item.id === id)).filter((item): item is T => item !== undefined);

  return [...matched, ...items.filter((item) => !ids.includes(item.id))].slice(0, 3);
}

export default function Overview() {
  const page = usePage<SharedData>();
  const userId = page.props.auth.user.id;
  const [recentServerIds, setRecentServerIds] = useState<number[]>([]);
  const [recentSiteIds, setRecentSiteIds] = useState<number[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [enabledWidgets, setEnabledWidgets] = useState<Set<WidgetKey>>(() => new Set(allWidgetKeys));

  useEffect(() => {
    setRecentServerIds(serverHelper.getAllRecentServers(userId, 25).map((server) => server.id));
    setRecentSiteIds(siteHelper.getAllRecentSites(userId, 25).map((site) => site.id));
    setEnabledWidgets(readEnabledWidgets(userId));
    setHistoryLoaded(true);
  }, [userId]);

  const toggleWidget = (key: WidgetKey) => {
    setEnabledWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      writeEnabledWidgets(userId, next);
      return next;
    });
  };

  const resources = useOverviewResources(undefined, recentServerIds, recentSiteIds, historyLoaded);
  const { isLoading } = resources;
  const data = resources.data;

  const recentServers = prioritize(data?.servers ?? [], recentServerIds);
  const recentSites = prioritize(data?.sites ?? [], recentSiteIds);
  const projects = data?.projects ?? [];
  const serverProviders = data?.server_providers ?? [];
  const sourceControls = data?.source_controls ?? [];
  const storageProviders = data?.storage_providers ?? [];
  const dnsProviders = data?.dns_providers ?? [];
  const backups = data?.backups ?? [];
  const domains = data?.domains ?? [];

  return (
    <Layout>
      <Head title="Overview" />
      <Container className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Heading title="Overview" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <LayoutGridIcon className="size-4" />
                Customize
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {WIDGETS.map((widget) => (
                <DropdownMenuCheckboxItem
                  key={widget.key}
                  checked={enabledWidgets.has(widget.key)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => toggleWidget(widget.key)}
                >
                  {widget.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {enabledWidgets.size === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
            No widgets selected. Use Customize to add some.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {enabledWidgets.has('servers') && (
              <QuickAccessCard
                title="Recent servers"
                viewAllHref={route('servers')}
                emptyText="No servers found."
                loading={isLoading}
                count={recentServers.length}
                onHide={() => toggleWidget('servers')}
              >
                {recentServers.map((server) => (
                  <ResourceRow
                    key={server.id}
                    href={route('servers.show', { server: server.id })}
                    icon={ServerIcon}
                    title={server.name}
                    subtitle={<span className="font-mono">{server.ip}</span>}
                    right={
                      <>
                        <IssueIndicator count={issueCount(server.status, server.status_color, server.warnings)} />
                        <StatusBadge status={server.status} color={server.status_color} />
                      </>
                    }
                  />
                ))}
              </QuickAccessCard>
            )}

            {enabledWidgets.has('sites') && (
              <QuickAccessCard
                title="Recent sites"
                viewAllHref={route('sites.all', { project: 'all' })}
                emptyText="No sites found."
                loading={isLoading}
                count={recentSites.length}
                onHide={() => toggleWidget('sites')}
              >
                {recentSites.map((site) => (
                  <ResourceRow
                    key={site.id}
                    href={route('application', { server: site.server_id, site: site.id })}
                    icon={GlobeIcon}
                    title={site.domain}
                    subtitle={site.server_name}
                    right={
                      <>
                        <IssueIndicator count={issueCount(site.status, site.status_color, site.warnings)} />
                        <StatusBadge status={site.status} color={site.status_color} />
                      </>
                    }
                  />
                ))}
              </QuickAccessCard>
            )}

            {enabledWidgets.has('projects') && (
              <QuickAccessCard
                title="Projects"
                viewAllHref={route('projects')}
                emptyText="No projects found."
                loading={isLoading}
                count={projects.length}
                onHide={() => toggleWidget('projects')}
              >
                {projects.map((project) => (
                  <ResourceRow
                    key={project.id}
                    href={route('projects')}
                    icon={FolderGit2Icon}
                    title={project.name}
                    subtitle={`${project.users_count} ${project.users_count === 1 ? 'user' : 'users'}`}
                    right={
                      project.is_current && (
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          Current
                        </Badge>
                      )
                    }
                  />
                ))}
              </QuickAccessCard>
            )}

            {enabledWidgets.has('server_providers') && (
              <QuickAccessCard
                title="Server Providers"
                viewAllHref={route('server-providers')}
                emptyText="No server providers configured."
                loading={isLoading}
                count={serverProviders.length}
                onHide={() => toggleWidget('server_providers')}
              >
                <ProviderRows items={serverProviders} href={route('server-providers')} />
              </QuickAccessCard>
            )}

            {enabledWidgets.has('source_controls') && (
              <QuickAccessCard
                title="Source Controls"
                viewAllHref={route('source-controls')}
                emptyText="No source controls configured."
                loading={isLoading}
                count={sourceControls.length}
                onHide={() => toggleWidget('source_controls')}
              >
                <ProviderRows items={sourceControls} href={route('source-controls')} />
              </QuickAccessCard>
            )}

            {enabledWidgets.has('storage_providers') && (
              <QuickAccessCard
                title="Storage Providers"
                viewAllHref={route('storage-providers')}
                emptyText="No storage providers configured."
                loading={isLoading}
                count={storageProviders.length}
                onHide={() => toggleWidget('storage_providers')}
              >
                <ProviderRows items={storageProviders} href={route('storage-providers')} />
              </QuickAccessCard>
            )}

            {enabledWidgets.has('dns_providers') && (
              <QuickAccessCard
                title="DNS Providers"
                viewAllHref={route('dns-providers')}
                emptyText="No DNS providers configured."
                loading={isLoading}
                count={dnsProviders.length}
                onHide={() => toggleWidget('dns_providers')}
              >
                <ProviderRows items={dnsProviders} href={route('dns-providers')} />
              </QuickAccessCard>
            )}

            {enabledWidgets.has('backups') && (
              <QuickAccessCard
                title="Backups"
                viewAllHref={route('backups.all')}
                emptyText="No backups configured."
                loading={isLoading}
                count={backups.length}
                onHide={() => toggleWidget('backups')}
              >
                {backups.map((backup) => (
                  <ResourceRow
                    key={backup.id}
                    href={route('backups.all')}
                    icon={CloudUploadIcon}
                    title={backup.name}
                    subtitle={backup.server_name || 'Server'}
                    right={
                      backup.interval && (
                        <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
                          {backup.interval}
                        </Badge>
                      )
                    }
                  />
                ))}
              </QuickAccessCard>
            )}

            {enabledWidgets.has('domains') && (
              <QuickAccessCard
                title="Domains"
                viewAllHref={route('domains')}
                emptyText="No domains configured."
                loading={isLoading}
                count={domains.length}
                onHide={() => toggleWidget('domains')}
              >
                {domains.map((domain) => (
                  <ResourceRow key={domain.id} href={route('domains')} icon={GlobeIcon} title={domain.domain} subtitle={domain.provider_name} />
                ))}
              </QuickAccessCard>
            )}
          </div>
        )}
      </Container>
    </Layout>
  );
}
