import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusRipple } from '@/components/status-ripple';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import { Link, router, usePage } from '@inertiajs/react';
import { ChevronDownIcon, ChevronLeftIcon, ExternalLinkIcon, ServerIcon } from 'lucide-react';
import { useEffect } from 'react';
import siteHelper from '@/lib/site-helper';

type SiteNavItem = {
  title: string;
  href: string;
  exact?: boolean;
  activePrefixes?: string[];
  count?: number | null;
  primary: boolean;
};

function buildItems(server: Server, site: Site): SiteNavItem[] {
  const base = `/servers/${server.id}/sites/${site.id}`;
  const workers = site.counts?.workers ?? 0;
  const domains = site.counts?.domains ?? 0;
  const resources = site.counts?.resources ?? 0;
  const cronJobs = site.counts?.cron_jobs ?? 0;
  const logErrorsToday = site.counts?.log_errors_today ?? 0;

  return [
    { title: 'Application', href: base, exact: true, activePrefixes: [`${base}/deployments/`], primary: true },
    { title: 'Commands', href: `${base}/commands`, primary: true },
    { title: 'Workers', href: `${base}/workers`, count: workers, primary: workers > 0 },
    { title: 'Domains', href: `${base}/domains`, count: domains, primary: domains >= 2 },
    { title: 'Topology', href: `${base}/topology`, primary: resources > 0 },
    { title: 'CronJobs', href: `${base}/cronjobs`, count: cronJobs, primary: cronJobs > 0 },
    ...(logErrorsToday > 0
      ? [{ title: 'Error Logs', href: `/servers/${server.id}/logs/services?key=${encodeURIComponent(`site:${site.id}:laravel`)}&level=error`, count: logErrorsToday, primary: true }]
      : []),
    { title: 'Settings', href: `${base}/settings`, primary: true },
    { title: 'Resources', href: `${base}/resources`, count: resources, primary: false },
    { title: 'Logs', href: `${base}/logs`, primary: false },
    { title: 'Redirects', href: `${base}/redirects`, primary: false },
    { title: 'Features', href: `${base}/features`, primary: false },
    { title: 'Tooling', href: `${base}/tooling`, primary: false },
  ];
}

function isActive(currentPath: string, item: SiteNavItem): boolean {
  const path = new URL(item.href, 'http://localhost').pathname;

  if (item.activePrefixes?.some((prefix) => currentPath.startsWith(prefix))) {
    return true;
  }

  return item.exact ? currentPath === path : currentPath === path || currentPath.startsWith(`${path}/`);
}

export function SiteHeaderNav() {
  const page = usePage<SharedData>();
  const initialSite = page.props.site;
  const initialServer = page.props.server;
  const site = useRealtimeRecord<Site>(initialSite, 'site');
  const server = useRealtimeRecord<Server>(initialServer, 'server');
  const userId = page.props.auth?.user?.id;

  useEffect(() => {
    if (initialSite?.status === 'installing' && site && (site.status === 'ready' || site.status === 'installation_failed')) {
      router.reload();
    }
  }, [site?.status, initialSite?.status]);

  useEffect(() => {
    if (!site || !server || !userId) {
      return;
    }

    const currentPath = page.url.split('?')[0];
    const activeItem = buildItems(server, site).find((item) => isActive(currentPath, item));

    if (activeItem) {
      siteHelper.recordVisitedSitePage(userId, site.id, activeItem.title);
    }
  }, [page.url, site, server, userId]);

  if (!site || !server) {
    return null;
  }

  const currentPath = page.url.split('?')[0];
  const items = buildItems(server, site);
  const primaryItems = items.filter((item) => item.primary);
  const otherItems = items.filter((item) => !item.primary);
  const otherActive = otherItems.some((item) => isActive(currentPath, item));

  return (
    <nav aria-label="Site navigation" className="bg-muted/30 flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/servers/${server.id}`}
            className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors"
          >
            <ChevronLeftIcon className="size-3.5" />
            <ServerIcon className="size-3.5" />
            <span className="max-w-[120px] truncate font-medium">{server.name}</span>
            <StatusRipple variant={server.status_color} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Back to server · {server.ip} · {server.status}
        </TooltipContent>
      </Tooltip>

      <div className="bg-border mx-1 h-5 w-px shrink-0" />

      {primaryItems.map((item) => {
        const active = isActive(currentPath, item);

        return (
          <Button
            key={item.title}
            variant="ghost"
            size="sm"
            className={cn('relative shrink-0 rounded-none px-3', active && 'text-foreground after:bg-primary after:absolute after:inset-x-2 after:bottom-[-7px] after:h-0.5')}
            asChild
          >
            <Link href={item.href} aria-current={active ? 'page' : undefined}>
              <span>{item.title}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="text-muted-foreground ml-1 text-xs">({item.count})</span>
              )}
            </Link>
          </Button>
        );
      })}

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('relative shrink-0 rounded-none px-3', otherActive && 'text-foreground after:bg-primary after:absolute after:inset-x-2 after:bottom-[-7px] after:h-0.5')}
          >
            Others
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {otherItems.map((item) => (
            <DropdownMenuItem key={item.title} asChild>
              <Link
                href={item.href}
                aria-current={isActive(currentPath, item) ? 'page' : undefined}
                className={cn(isActive(currentPath, item) && 'bg-accent font-medium')}
              >
                {item.title}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {site.status === 'installation_failed' && <Badge variant={site.status_color}>{site.status}</Badge>}
        <Button variant="outline" size="icon" className="size-8" asChild>
          <a href={site.url} target="_blank" rel="noopener noreferrer" aria-label="Open site">
            <ExternalLinkIcon className="size-3.5" />
          </a>
        </Button>
      </div>
    </nav>
  );
}
