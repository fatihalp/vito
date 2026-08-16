import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { SiteResource } from '@/types/site-resource';
import { HostedDomain } from '@/types/hosted-domain';
import { DNSProvider } from '@/types/dns-provider';
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
  ArrowDownIcon,
  LayersIcon,
  CloudIcon,
  ShieldCheckIcon,
  NetworkIcon,
  RadioIcon,
  CpuIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from '@/hooks/use-dialog';
import RevealSiteResourceDialog from '@/pages/site-resources/components/reveal-site-resource-dialog';

interface SiteResourceDiagramProps {
  server: Server;
  site: Site;
  resources: SiteResource[];
  hostedDomains?: HostedDomain[];
  dnsProviders?: DNSProvider[];
  workersCount?: number;
  cronJobsCount?: number;
}

export default function SiteResourceDiagram({
  server,
  site,
  resources = [],
  hostedDomains = [],
  dnsProviders = [],
  workersCount = 0,
  cronJobsCount = 0,
}: SiteResourceDiagramProps) {
  const [selectedResource, setSelectedResource] = useState<SiteResource | null>(null);
  const [isDetailed, setIsDetailed] = useState(false);
  const dialog = useDialog();

  const dbResource = resources.find((r) => r.type_value === 'database');
  const cacheResource = resources.find((r) => r.type_value === 'cache');
  const bucketResource = resources.find((r) => r.type_value === 'bucket');

  const resourcesUrl = route('site-resources', { server: server.id, site: site.id });

  // Cloudflare and DNS state detection
  const connectedCloudflare = dnsProviders.find((p) => p.connected && p.provider === 'cloudflare');
  const hasCloudflare = Boolean(connectedCloudflare);
  const anyConnectedDns = dnsProviders.some((p) => p.connected);

  // Filter custom domains (excluding the primary domain)
  const customDomains = hostedDomains.filter(
    (hd) => hd.domain.toLowerCase() !== site.domain.toLowerCase() && hd.type !== 'primary',
  );

  return (
    <Card className="overflow-hidden border-border/60 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-foreground/80">
            <LayersIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Infrastructure Topology</CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Simple / Detailed View Toggle */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
            onClick={() => setIsDetailed(!isDetailed)}
            title={isDetailed ? 'Switch to simple view' : 'Switch to detailed view'}
          >
            <SlidersHorizontalIcon className="size-3.5" />
            <span>{isDetailed ? 'Simple' : 'Details'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
            onClick={() => dialog.createHostedDomain.open({ site })}
          >
            <PlusIcon className="size-3.5" />
            <span>Add Domain</span>
          </Button>
          <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60">
            <Link href={resourcesUrl}>
              Resources
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1.1fr_auto_1fr] items-stretch gap-4 lg:gap-2">
          
          {/* ================= COLUMN 1: NETWORK & EDGE ================= */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <NetworkIcon className="size-3.5 text-muted-foreground/80" />
                <span>Network</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Edge</span>
            </div>

            {/* Edge Network Card */}
            <div className="group relative rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 hover:border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                    <CloudIcon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-foreground">Edge Network</h4>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {hasCloudflare ? 'Cloudflare CDN' : 'Direct DNS'}
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {hasCloudflare ? 'Cloudflare' : anyConnectedDns ? 'DNS' : 'Active'}
                </span>
              </div>

              {/* Detailed Specs when expanded */}
              {isDetailed && (
                <div className="mt-3 space-y-2 border-t border-border/40 pt-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <ShieldCheckIcon className="size-3 text-muted-foreground/70" />
                      <span>DDoS Protection</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {hasCloudflare ? 'Active' : 'Origin Shield'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <RadioIcon className="size-3 text-muted-foreground/70" />
                      <span>CDN & Routing</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {hasCloudflare ? 'Proxied' : 'Direct (80/443)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <LockIcon className="size-3 text-muted-foreground/70" />
                      <span>Edge SSL</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-foreground font-medium">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {site.ssl_enabled ? 'Strict' : 'Disabled'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Domains Card */}
            <div className="group relative rounded-xl border border-border/60 bg-card p-3.5 transition-all duration-200 hover:border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                    <GlobeIcon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-foreground">Domains</h4>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {1 + customDomains.length} {1 + customDomains.length === 1 ? 'domain' : 'domains'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-md font-medium"
                  onClick={() => dialog.createHostedDomain.open({ site })}
                >
                  <PlusIcon className="size-3" />
                  <span>Add</span>
                </Button>
              </div>

              {/* Simple View: Compact domain summary */}
              {!isDetailed && (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono text-xs font-medium text-foreground truncate max-w-[130px]" title={site.domain}>
                      {site.domain}
                    </span>
                  </div>
                  {customDomains.length > 0 && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      +{customDomains.length} alias
                    </span>
                  )}
                </div>
              )}

              {/* Detailed View: Full domain breakdown */}
              {isDetailed && (
                <div className="mt-3 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-mono text-xs font-medium text-foreground truncate max-w-[130px]" title={site.domain}>
                        {site.domain}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground border border-border/50 rounded px-1">
                      Primary
                    </span>
                  </div>

                  {customDomains.map((hd) => (
                    <div
                      key={hd.id}
                      className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            hd.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500',
                          )}
                        />
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[130px]" title={hd.domain}>
                          {hd.domain}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground capitalize">
                        {hd.type || 'Alias'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================= FLOW CONNECTOR 1: NETWORK -> COMPUTE ================= */}
          <div className="hidden lg:flex flex-col items-center justify-center px-1 z-10 select-none">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center">
                <div className="h-px w-3 bg-border/80" />
                <div className="flex size-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-xs">
                  <ArrowRightIcon className="size-3" />
                </div>
                <div className="h-px w-3 bg-border/80" />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                Route
              </span>
            </div>
          </div>

          {/* Mobile Downward Connector 1 */}
          <div className="flex lg:hidden items-center justify-center py-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <div className="h-px w-8 bg-border/60" />
              <ArrowDownIcon className="size-3" />
              <span>Route</span>
              <div className="h-px w-8 bg-border/60" />
            </div>
          </div>

          {/* ================= COLUMN 2: COMPUTE & APP CLUSTER ================= */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <ServerIcon className="size-3.5 text-muted-foreground/80" />
                <span>Host & Compute</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">{server.stage || 'prod'}</span>
            </div>

            {/* Host Server & Application Target Card */}
            <div className="group relative rounded-xl border border-border/80 bg-card p-3.5 transition-all duration-200 hover:border-border shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-foreground font-bold text-sm shrink-0">
                    {site.domain.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-bold text-foreground font-mono" title={site.domain}>
                      {site.domain}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {server.name} ({site.php_version ? `PHP ${site.php_version}` : 'Node'})
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {site.status || 'Ready'}
                </span>
              </div>

              {/* Detailed Specs when expanded */}
              {isDetailed ? (
                <>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-2 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Host Server:</span>
                      <span className="font-mono font-medium text-foreground">{server.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Public IP:</span>
                      <span className="font-mono font-medium text-foreground">{server.ip}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-border/40 pt-2 text-[11px]">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">Web Server</span>
                      <span className="font-mono text-foreground">{site.webserver || 'Nginx'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground">User</span>
                      <span className="font-mono text-foreground truncate">{site.user}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground font-mono">
                  <span>IP: {server.ip}</span>
                  <span className="flex items-center gap-1 text-foreground">
                    <LockIcon className="size-2.5 text-muted-foreground" />
                    {site.ssl_enabled ? 'SSL' : 'No SSL'}
                  </span>
                </div>
              )}
            </div>

            {/* Background Queues & Cron Card */}
            <div className="group relative rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                    <ListOrderedIcon className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-medium text-foreground">Queues & Cron</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {workersCount} {workersCount === 1 ? 'worker' : 'workers'} • {cronJobsCount} {cronJobsCount === 1 ? 'cron' : 'crons'}
                    </p>
                  </div>
                </div>
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>

          {/* ================= FLOW CONNECTOR 2: COMPUTE -> RESOURCES ================= */}
          <div className="hidden lg:flex flex-col items-center justify-center px-1 z-10 select-none">
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center">
                <div className="h-px w-3 bg-border/80" />
                <div className="flex size-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-xs">
                  <ArrowRightIcon className="size-3" />
                </div>
                <div className="h-px w-3 bg-border/80" />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                Data
              </span>
            </div>
          </div>

          {/* Mobile Downward Connector 2 */}
          <div className="flex lg:hidden items-center justify-center py-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <div className="h-px w-8 bg-border/60" />
              <ArrowDownIcon className="size-3" />
              <span>Data</span>
              <div className="h-px w-8 bg-border/60" />
            </div>
          </div>

          {/* ================= COLUMN 3: DATA & STORAGE RESOURCES ================= */}
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <DatabaseIcon className="size-3.5 text-muted-foreground/80" />
                <span>Resources</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Storage</span>
            </div>

            {/* Database Resource Card */}
            {dbResource ? (
              <div className="group rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                      <DatabaseIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-medium text-foreground truncate">Database</h4>
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {dbResource.server?.name || dbResource.server?.ip || 'Attached'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 shrink-0 border-border/60 text-muted-foreground hover:text-foreground"
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
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 transition-colors hover:border-border hover:bg-muted/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                    <DatabaseIcon className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Database</h4>
                    <p className="text-[10px] text-muted-foreground">Local / Not attached</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground">
                  <PlusIcon className="size-3" />
                  <span>Attach</span>
                </div>
              </Link>
            )}

            {/* Cache / Redis Resource Card */}
            {cacheResource ? (
              <div className="group rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                      <ZapIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-medium text-foreground truncate">Cache</h4>
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {cacheResource.server?.name || cacheResource.server?.ip || 'Attached'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 shrink-0 border-border/60 text-muted-foreground hover:text-foreground"
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
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 transition-colors hover:border-border hover:bg-muted/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                    <ZapIcon className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Cache (Redis)</h4>
                    <p className="text-[10px] text-muted-foreground">Local / Not attached</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground">
                  <PlusIcon className="size-3" />
                  <span>Attach</span>
                </div>
              </Link>
            )}

            {/* Storage Bucket Resource Card */}
            {bucketResource ? (
              <div className="group rounded-xl border border-border/60 bg-card p-3 transition-all duration-200 hover:border-border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-muted/30 text-muted-foreground shrink-0">
                      <HardDriveIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-medium text-foreground truncate">Storage</h4>
                        <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {bucketResource.bucket?.name || 'Attached'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 shrink-0 border-border/60 text-muted-foreground hover:text-foreground"
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
                className="group flex items-center justify-between rounded-xl border border-dashed border-border/60 bg-muted/10 p-3 transition-colors hover:border-border hover:bg-muted/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-7 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground">
                    <HardDriveIcon className="size-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-foreground">Object Storage</h4>
                    <p className="text-[10px] text-muted-foreground">S3 / Bucket</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground group-hover:text-foreground">
                  <PlusIcon className="size-3" />
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


