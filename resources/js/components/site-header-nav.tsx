import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusRipple } from '@/components/status-ripple';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { cn, humanizeStep } from '@/lib/utils';
import { type SharedData } from '@/types';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import { Link, router, usePage } from '@inertiajs/react';
import { ChevronDownIcon, ChevronLeftIcon, ExternalLinkIcon, LoaderCircleIcon, ServerIcon } from 'lucide-react';
import { useEffect } from 'react';
import siteHelper from '@/lib/site-helper';

type SiteNavItem = {
  title: string;
  href: string;
  exact?: boolean;
  activePrefixes?: string[];
  count?: number | null;
};

function buildPrimaryItems(server: Server, site: Site): SiteNavItem[] {
  const routeParams = { server: server.id, site: site.id };
  const applicationHref = route('application', routeParams);
  const applicationPath = new URL(applicationHref, 'http://localhost').pathname;

  return [
    { title: 'Application', href: applicationHref, exact: true, activePrefixes: [`${applicationPath}/deployments/`] },
    { title: 'Resources', href: route('site-resources', routeParams), count: site.counts.resources },
    { title: 'Domains', href: route('hosted-domains', routeParams), count: site.counts.domains },
    { title: 'Commands', href: route('commands', routeParams), count: site.counts.commands },
    { title: 'Workers', href: route('workers.site', routeParams), count: site.counts.workers },
    { title: 'Settings', href: route('site-settings', routeParams) },
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
    const activeItem = buildPrimaryItems(server, site).find((item) => isActive(currentPath, item));

    if (activeItem) {
      siteHelper.recordVisitedSitePage(userId, site.id, activeItem.title);
    }
  }, [page.url, site, server, userId]);

  if (!site || !server) {
    return null;
  }

  const currentPath = page.url.split('?')[0];
  const routeParams = { server: server.id, site: site.id };
  const primaryItems: SiteNavItem[] = buildPrimaryItems(server, site);
  const otherItems: SiteNavItem[] = [
    { title: 'Features', href: route('site-features', routeParams) },
    { title: 'Tooling', href: route('site-tooling', routeParams) },
    { title: 'CronJobs', href: route('cronjobs.site', routeParams) },
    { title: 'Redirects', href: route('redirects', routeParams) },
    { title: 'Logs', href: route('sites.logs', routeParams) },
  ];
  const otherActive = otherItems.some((item) => isActive(currentPath, item));
  const siteInstalling = ['installing', 'installation_failed'].includes(site.status);

  return (
    <nav aria-label="Site navigation" className="bg-muted/30 flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b px-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={route('servers.show', { server: server.id })}
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
        {siteInstalling && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <LoaderCircleIcon className={cn('size-4', site.status === 'installing' && 'text-brand animate-spin')} />
            <span>{parseInt((site.progress ?? 0).toString())}%</span>
            {site.status === 'installing' && site.progress_step && <span className="hidden lg:inline">{humanizeStep(site.progress_step)}</span>}
            {site.status === 'installation_failed' && <Badge variant={site.status_color}>{site.status}</Badge>}
          </div>
        )}
        <Button variant="outline" size="sm" className="h-8" asChild>
          <a href={site.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="size-3.5" />
            <span className="hidden sm:inline">Open site</span>
          </a>
        </Button>
      </div>
    </nav>
  );
}
