import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDownIcon, GlobeIcon } from 'lucide-react';

type SiteNavItem = {
  title: string;
  href: string;
  exact?: boolean;
  activePrefixes?: string[];
  count?: number | null;
};

function isActive(currentPath: string, item: SiteNavItem): boolean {
  const path = new URL(item.href, 'http://localhost').pathname;

  if (item.activePrefixes?.some((prefix) => currentPath.startsWith(prefix))) {
    return true;
  }

  return item.exact ? currentPath === path : currentPath === path || currentPath.startsWith(`${path}/`);
}

export function SiteHeaderNav() {
  const page = usePage<SharedData>();
  const site = page.props.site;
  const server = page.props.server;

  if (!site || !server) {
    return null;
  }

  const currentPath = page.url.split('?')[0];
  const routeParams = { server: server.id, site: site.id };
  const applicationHref = route('application', routeParams);
  const applicationPath = new URL(applicationHref, 'http://localhost').pathname;
  const primaryItems: SiteNavItem[] = [
    { title: 'Application', href: applicationHref, exact: true, activePrefixes: [`${applicationPath}/deployments/`] },
    { title: 'Resources', href: route('site-resources', routeParams), count: site.counts.resources },
    { title: 'Domains', href: route('hosted-domains', routeParams), count: site.counts.domains },
    { title: 'Commands', href: route('commands', routeParams), count: site.counts.commands },
    { title: 'Workers', href: route('workers.site', routeParams), count: site.counts.workers },
    { title: 'Settings', href: route('site-settings', routeParams) },
  ];
  const otherItems: SiteNavItem[] = [
    { title: 'Features', href: route('site-features', routeParams) },
    { title: 'Tooling', href: route('site-tooling', routeParams) },
    { title: 'CronJobs', href: route('cronjobs.site', routeParams) },
    { title: 'Redirects', href: route('redirects', routeParams) },
    { title: 'Logs', href: route('sites.logs', routeParams) },
  ];
  const otherActive = otherItems.some((item) => isActive(currentPath, item));

  return (
    <nav aria-label="Site navigation" className="bg-muted/30 flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b px-4">
      <div className="text-muted-foreground mr-2 flex shrink-0 items-center gap-1.5 text-xs font-medium tracking-wider uppercase" title="This site's settings">
        <GlobeIcon className="size-3.5" />
        Site
      </div>
      <div className="bg-border mr-1 h-5 w-px shrink-0" />
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
              {item.title}
              {!!item.count && <span className="text-muted-foreground ml-1 text-xs">({item.count})</span>}
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
    </nav>
  );
}
