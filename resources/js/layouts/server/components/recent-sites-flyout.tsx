import { Server } from '@/types/server';
import { SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRightIcon, GlobeIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import siteHelper from '@/lib/site-helper';
import { useOverviewResources, type OverviewSite } from '@/hooks/use-overview-resources';
import { useMemo } from 'react';

export default function RecentSitesFlyout({ server }: { server: Server }) {
  const page = usePage<SharedData>();
  const userId = page.props.auth?.user?.id;

  const recentSiteIds = useMemo(() => {
    if (!userId || !server?.id) return [];
    return siteHelper.getRecentSites(userId, server.id, 10).map((s) => s.id);
  }, [userId, server?.id]);

  const resources = useOverviewResources(
    server.project_id,
    [],
    recentSiteIds,
    Boolean(server.project_id),
    server.id,
  );

  const sites = resources.data?.sites ?? [];

  const displaySites = useMemo(() => {
    const matchedRecent = recentSiteIds
      .map((id) => sites.find((s) => s.id === id && s.server_id === server.id))
      .filter((s): s is OverviewSite => s !== undefined);
    const otherServerSites = sites.filter((s) => s.server_id === server.id && !recentSiteIds.includes(s.id));
    return [...matchedRecent, ...otherServerSites].slice(0, 10);
  }, [recentSiteIds, sites, server.id]);

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Sites
        </span>
        <Link
          href={route('sites', { server: server.id })}
          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>All</span>
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      {resources.isLoading && displaySites.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Loading recent sites...
        </div>
      ) : displaySites.length > 0 ? (
        <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
          {displaySites.map((site) => (
            <Link
              key={site.id}
              href={route('application', { server: server.id, site: site.id })}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-accent hover:text-accent-foreground transition-colors group"
              prefetch
            >
              <div className="flex min-w-0 items-center gap-2">
                <GlobeIcon className="size-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                <span className="truncate font-medium">{site.domain}</span>
              </div>
              <Badge variant={site.status_color} className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                {site.status}
              </Badge>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-3 px-2 text-center text-xs text-muted-foreground">
          <p>No sites on this server yet.</p>
          <Link
            href={route('sites', { server: server.id })}
            className="text-primary hover:underline mt-1 inline-block text-xs font-medium"
          >
            Create site
          </Link>
        </div>
      )}
    </div>
  );
}
