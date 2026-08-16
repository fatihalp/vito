import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { SiteResource } from '@/types/site-resource';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GlobeIcon,
  DatabaseIcon,
  ZapIcon,
  HardDriveIcon,
  ServerIcon,
  ListOrderedIcon,
  LockIcon,
  KeyIcon,
  PlusIcon,
  ArrowRightIcon,
  LayersIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RevealSiteResourceDialog from '@/pages/site-resources/components/reveal-site-resource-dialog';

interface SiteResourceDiagramProps {
  server: Server;
  site: Site;
  resources: SiteResource[];
  workersCount?: number;
  cronJobsCount?: number;
}

export default function SiteResourceDiagram({
  server,
  site,
  resources = [],
  workersCount = 0,
  cronJobsCount = 0,
}: SiteResourceDiagramProps) {
  const [selectedResource, setSelectedResource] = useState<SiteResource | null>(null);

  const dbResource = resources.find((r) => r.type_value === 'database');
  const cacheResource = resources.find((r) => r.type_value === 'cache');
  const bucketResource = resources.find((r) => r.type_value === 'bucket');

  const resourcesUrl = route('site-resources', { server: server.id, site: site.id });

  return (
    <Card className="overflow-hidden border-border/70 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <LayersIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Architecture & Infrastructure Diagram</CardTitle>
            <p className="text-xs text-muted-foreground">Topology of active server, database, cache, storage, and background processes</p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
          <Link href={resourcesUrl}>
            Manage Resources
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Host Infrastructure & Background */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            {/* Host Server Node */}
            <div className="group relative rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-500">
                    <ServerIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">Host Server</h4>
                    <p className="font-mono text-xs font-medium text-foreground truncate max-w-[130px]">{server.name}</p>
                  </div>
                </div>
                <span className="size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] text-muted-foreground font-mono">
                <span>IP: {server.ip}</span>
                <span className="capitalize">{server.stage || 'prod'}</span>
              </div>
            </div>

            {/* Background Workers & Schedulers Node */}
            <div className="group relative rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500">
                    <ListOrderedIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">Queues & Cron</h4>
                    <p className="text-xs text-muted-foreground">Background Services</p>
                  </div>
                </div>
                <span className={cn('size-2 rounded-full ring-4', (workersCount > 0 || cronJobsCount > 0) ? 'bg-emerald-500 ring-emerald-500/20' : 'bg-muted-foreground/40 ring-muted/20')} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[11px] text-muted-foreground">
                <span>{workersCount} {workersCount === 1 ? 'Worker' : 'Workers'}</span>
                <span>{cronJobsCount} {cronJobsCount === 1 ? 'Cron' : 'Crons'}</span>
              </div>
            </div>
          </div>

          {/* Middle Column: Central Site Node with Connection Indicators */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm">
              {/* Pulsing indicator */}
              <div className="absolute -top-2.5 right-4 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider backdrop-blur-sm">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {site.status || 'Active'}
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-xl">
                  {site.domain.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Application Target</span>
                  <h3 className="truncate text-base font-bold text-foreground">{site.domain}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {site.php_version && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono">
                        PHP {site.php_version}
                      </Badge>
                    )}
                    {site.ssl_enabled && (
                      <Badge variant="success" className="h-5 gap-1 px-1.5 text-[10px]">
                        <LockIcon className="size-2.5" />
                        SSL
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">User</span>
                  <span className="font-mono font-medium truncate">{site.user}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground">Web Server</span>
                  <span className="font-mono font-medium truncate">{site.webserver || 'Nginx'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Attached Dedicated Resources */}
          <div className="flex flex-col gap-3 lg:col-span-4">
            {/* Database Resource Card */}
            {dbResource ? (
              <div className="group rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 transition-all duration-200 hover:border-emerald-500/60 hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                      <DatabaseIcon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-foreground">Database</h4>
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <p className="font-mono text-xs font-medium text-muted-foreground truncate max-w-[140px]">
                        {dbResource.server?.name || dbResource.server?.ip || 'Connected'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSelectedResource(dbResource)}
                  >
                    <KeyIcon className="size-3" />
                    Keys
                  </Button>
                </div>
              </div>
            ) : (
              <Link
                href={resourcesUrl}
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground group-hover:text-primary">
                    <DatabaseIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Database</h4>
                    <p className="text-[11px] text-muted-foreground">Local / Not attached</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                  <PlusIcon className="size-3.5" />
                  <span>Attach</span>
                </div>
              </Link>
            )}

            {/* Cache / Redis Resource Card */}
            {cacheResource ? (
              <div className="group rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 transition-all duration-200 hover:border-rose-500/60 hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500">
                      <ZapIcon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-foreground">Cache (Redis)</h4>
                        <span className="size-1.5 rounded-full bg-rose-500" />
                      </div>
                      <p className="font-mono text-xs font-medium text-muted-foreground truncate max-w-[140px]">
                        {cacheResource.server?.name || cacheResource.server?.ip || 'Connected'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSelectedResource(cacheResource)}
                  >
                    <KeyIcon className="size-3" />
                    Keys
                  </Button>
                </div>
              </div>
            ) : (
              <Link
                href={resourcesUrl}
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground group-hover:text-primary">
                    <ZapIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Cache (Redis)</h4>
                    <p className="text-[11px] text-muted-foreground">Local / Not attached</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                  <PlusIcon className="size-3.5" />
                  <span>Attach</span>
                </div>
              </Link>
            )}

            {/* Storage Bucket Resource Card */}
            {bucketResource ? (
              <div className="group rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5 transition-all duration-200 hover:border-indigo-500/60 hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-500">
                      <HardDriveIcon className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-foreground">S3 Storage Bucket</h4>
                        <span className="size-1.5 rounded-full bg-indigo-500" />
                      </div>
                      <p className="font-mono text-xs font-medium text-muted-foreground truncate max-w-[140px]">
                        {bucketResource.bucket?.name || 'Attached Bucket'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => setSelectedResource(bucketResource)}
                  >
                    <KeyIcon className="size-3" />
                    Keys
                  </Button>
                </div>
              </div>
            ) : (
              <Link
                href={resourcesUrl}
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/80 bg-muted/20 p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground group-hover:text-primary">
                    <HardDriveIcon className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Object Storage</h4>
                    <p className="text-[11px] text-muted-foreground">S3 / Hetzner Bucket</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
                  <PlusIcon className="size-3.5" />
                  <span>Attach</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </CardContent>

      {selectedResource && (
        <RevealSiteResourceDialog
          open={!!selectedResource}
          onOpenChange={(open) => {
            if (!open) setSelectedResource(null);
          }}
          serverId={server.id}
          siteId={site.id}
          resource={selectedResource}
        />
      )}
    </Card>
  );
}
