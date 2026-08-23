import { SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ArrowRightIcon, ServerIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useOverviewResources } from '@/hooks/use-overview-resources';

export default function RecentServersFlyout() {
  const page = usePage<SharedData>();
  const projectId = page.props.auth?.currentProject?.id;
  const resources = useOverviewResources(projectId, [], [], Boolean(projectId));
  const servers = resources.data?.servers ?? [];

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/60 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Servers
        </span>
        <Link
          href={route('servers')}
          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
        >
          <span>View all</span>
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      {resources.isLoading && servers.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Loading servers...
        </div>
      ) : servers.length > 0 ? (
        <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
          {servers.slice(0, 10).map((server) => (
            <Link
              key={server.id}
              href={route('servers.show', { server: server.id })}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-accent hover:text-accent-foreground transition-colors group"
              prefetch
            >
              <div className="flex min-w-0 items-center gap-2">
                <ServerIcon className="size-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
                <div className="min-w-0 truncate">
                  <div className="truncate font-medium">{server.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{server.ip}</div>
                </div>
              </div>
              <Badge variant={server.status_color} className="text-[10px] px-1.5 py-0 shrink-0 font-normal">
                {server.status}
              </Badge>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-3 px-2 text-center text-xs text-muted-foreground">
          <p>No servers found.</p>
          <Link
            href={route('servers')}
            className="text-primary hover:underline mt-1 inline-block text-xs font-medium"
          >
            Create server
          </Link>
        </div>
      )}
    </div>
  );
}
