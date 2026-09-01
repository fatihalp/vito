import { useState, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { SiteResource } from '@/types/site-resource';
import { HostedDomain } from '@/types/hosted-domain';
import { DNSProvider } from '@/types/dns-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  GlobeIcon,
  DatabaseIcon,
  ZapIcon,
  HardDriveIcon,
  ServerIcon,
  PlusIcon,
  LayersIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  InfoIcon,
  Layers3Icon,
  CpuIcon,
  BoxesIcon,
  KeyIcon,
  RadioIcon,
  LockIcon,
  SettingsIcon,
  LoaderCircleIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from '@/hooks/use-dialog';
import RevealSiteResourceDialog from '@/pages/site-resources/components/reveal-site-resource-dialog';
import EdgeNetworkDialog from './edge-network-dialog';

interface SiteResourceDiagramProps {
  server: Server;
  site: Site;
  resources: SiteResource[];
  hostedDomains?: HostedDomain[];
  dnsProviders?: DNSProvider[];
  workersCount?: number;
  cronJobsCount?: number;
  domainProxyStatus?: Record<string, boolean>;
}

export default function SiteResourceDiagram({
  server,
  site,
  resources = [],
  hostedDomains = [],
  dnsProviders = [],
  workersCount = 0,
  cronJobsCount = 0,
  domainProxyStatus = {},
}: SiteResourceDiagramProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<SiteResource | null>(null);
  const [isDetailed, setIsDetailed] = useState(false);
  const [isEdgeDialogOpen, setIsEdgeDialogOpen] = useState(false);
  const [togglingDomain, setTogglingDomain] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dialog = useDialog();

  const handleToggleProxy = (e: React.MouseEvent, domainName: string, currentStatus: boolean) => {
    e.stopPropagation();
    setTogglingDomain(domainName);
    router.post(
      route('sites.toggle-domain-proxy', { server: server.id, site: site.id }),
      {
        domain: domainName,
        proxied: !currentStatus,
      },
      {
        preserveScroll: true,
        onFinish: () => setTogglingDomain(null),
      },
    );
  };

  const toggleMode = (detailed: boolean) => {
    if (detailed === isDetailed) return;

    const rect = containerRef.current?.getBoundingClientRect();
    setIsDetailed(detailed);

    if (rect && rect.top < 0) {
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const dbResource = resources.find((r) => r.type_value === 'database');
  const cacheResource = resources.find((r) => r.type_value === 'cache');
  const storageResource = resources.find((r) => r.type_value === 'storage');

  const attachedResourcesCount = [dbResource, cacheResource, storageResource].filter(Boolean).length;

  const resourcesUrl = route('site-resources', { server: server.id, site: site.id });

  const connectedCloudflare = dnsProviders.find((p) => p.connected && p.provider === 'cloudflare');
  const hasCloudflare = Boolean(connectedCloudflare);
  const anyConnectedDns = dnsProviders.some((p) => p.connected);

  const isPrimaryProxied = Boolean(domainProxyStatus[site.domain]);

  const customDomains = hostedDomains.filter(
    (hd) => hd.domain.toLowerCase() !== site.domain.toLowerCase() && hd.type !== 'primary',
  );

  const regionLabel = server.provider || 'Host Infrastructure';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card ref={containerRef} className="relative overflow-hidden border-border/60 shadow-xs transition-all duration-200">
        <div
          className={cn(
            'flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 py-2.5 transition-colors',
            isOpen ? 'border-b bg-muted/20' : 'hover:bg-muted/10',
          )}
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/40 text-foreground/80 group-hover:border-border group-hover:bg-muted/70 transition-colors">
                <LayersIcon className="size-3.5" />
              </div>
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  Infrastructure Topology
                </span>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/40">
                    <span
                      className={cn(
                        'size-1.5 rounded-full',
                        isPrimaryProxied
                          ? 'bg-emerald-500'
                          : hasCloudflare
                          ? 'bg-amber-500/80'
                          : anyConnectedDns
                          ? 'bg-muted-foreground/50'
                          : 'bg-muted-foreground/40',
                      )}
                    />
                    {hasCloudflare ? (isPrimaryProxied ? 'Cloudflare (Proxied)' : 'Cloudflare') : anyConnectedDns ? 'DNS' : 'Direct'}
                  </span>

                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/40 font-mono">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {site.php_version ? `PHP ${site.php_version}` : site.type}
                  </span>

                  {attachedResourcesCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/40">
                      <DatabaseIcon className="size-2.5" />
                      {attachedResourcesCount} {attachedResourcesCount === 1 ? 'resource' : 'resources'}
                    </span>
                  )}

                  {(workersCount > 0 || cronJobsCount > 0) && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground border border-border/40">
                      <Layers3Icon className="size-2.5" />
                      {workersCount > 0 && `${workersCount}w`}
                      {workersCount > 0 && cronJobsCount > 0 && ' · '}
                      {cronJobsCount > 0 && `${cronJobsCount}c`}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDownIcon
                className={cn('size-4 text-muted-foreground transition-transform duration-200 ml-auto sm:ml-0 shrink-0', isOpen && 'rotate-180')}
              />
            </button>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
            {isOpen && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMode(!isDetailed);
                }}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <LayersIcon className="size-3" />
                <span>{isDetailed ? 'Overview mode' : 'Detailed mode'}</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-7 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
            >
              <Link href={resourcesUrl} onClick={(e) => e.stopPropagation()}>
                <ExternalLinkIcon className="size-3" />
                <span>Resources</span>
              </Link>
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="p-3.5 sm:p-4">
            <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1.1fr_auto_1.15fr] items-stretch gap-3 lg:gap-0">
              {/* Column 1: Network */}
              <div className="rounded-xl border border-border/50 bg-muted/15 p-3 flex flex-col gap-2.5 relative z-10">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-0.5">
                  <span>Network</span>
                  <InfoIcon className="size-3 text-muted-foreground/60" />
                </div>

                <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsEdgeDialogOpen(true)}
                      className="flex items-center gap-2 text-left group cursor-pointer"
                    >
                      <BoxesIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">Edge network</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEdgeDialogOpen(true)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/40 hover:border-border transition-colors cursor-pointer"
                      >
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            isPrimaryProxied
                              ? 'bg-emerald-500'
                              : hasCloudflare
                              ? 'bg-amber-500/80'
                              : anyConnectedDns
                              ? 'bg-muted-foreground/50'
                              : 'bg-muted-foreground/40',
                          )}
                        />
                        {hasCloudflare ? (isPrimaryProxied ? 'Cloudflare (Proxied)' : 'Cloudflare (DNS Only)') : anyConnectedDns ? 'DNS' : 'Direct'}
                        <SettingsIcon className="size-2.5 opacity-60 ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {isDetailed && (
                    <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsEdgeDialogOpen(true)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <ShieldCheckIcon className="size-3 text-muted-foreground/70" />
                          <span>DDoS protection</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              isPrimaryProxied ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                          />
                          {isPrimaryProxied
                            ? 'Active (Cloudflare)'
                            : hasCloudflare
                            ? 'DNS Only'
                            : 'Origin Shield'}
                        </span>
                      </div>

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsEdgeDialogOpen(true)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <RadioIcon className="size-3 text-muted-foreground/70" />
                          <span>CDN &amp; Routing</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              isPrimaryProxied ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                          />
                          {isPrimaryProxied
                            ? 'Edge Proxied'
                            : hasCloudflare
                            ? 'DNS Only'
                            : 'Direct (80/443)'}
                        </span>
                      </div>

                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setIsEdgeDialogOpen(true)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <LockIcon className="size-3 text-muted-foreground/70" />
                          <span>Edge SSL / TLS</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              isPrimaryProxied || site.ssl_enabled ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                            )}
                          />
                          {isPrimaryProxied
                            ? 'Edge SSL + Origin'
                            : site.ssl_enabled
                            ? 'Origin HTTPS'
                            : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GlobeIcon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Domains</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => dialog.createHostedDomain.open({ site })}
                      className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px] cursor-pointer"
                    >
                      <PlusIcon className="size-3" />
                      <span>Add</span>
                    </button>
                  </div>

                  {isDetailed ? (
                    <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              'size-1.5 rounded-full shrink-0',
                              isPrimaryProxied ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                            )}
                          />
                          <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[120px]" title={site.domain}>
                            {site.domain}
                          </span>
                        </span>

                        {hasCloudflare ? (
                          <button
                            type="button"
                            disabled={togglingDomain === site.domain}
                            onClick={(e) => handleToggleProxy(e, site.domain, isPrimaryProxied)}
                            className={cn(
                              'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border cursor-pointer',
                              isPrimaryProxied
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted',
                              togglingDomain === site.domain && 'opacity-60 pointer-events-none',
                            )}
                            title={isPrimaryProxied ? 'Cloudflare Proxy & Security Active' : 'DNS Only (Direct Origin)'}
                          >
                            {togglingDomain === site.domain ? (
                              <LoaderCircleIcon className="size-2.5 animate-spin" />
                            ) : isPrimaryProxied ? (
                              <ShieldCheckIcon className="size-2.5 text-emerald-500" />
                            ) : (
                              <ShieldAlertIcon className="size-2.5 text-muted-foreground" />
                            )}
                            <span>{isPrimaryProxied ? 'Protected' : 'DNS only'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-muted-foreground">Direct</span>
                        )}
                      </div>

                      {customDomains.length > 0 ? (
                        <div className="space-y-1 pt-1 border-t border-border/30">
                          {customDomains.map((hd) => {
                            const isProxied = Boolean(domainProxyStatus[hd.domain]);
                            const isUpdating = togglingDomain === hd.domain;

                            return (
                              <div key={hd.id} className="flex items-center justify-between text-[11px] font-mono">
                                <span className="truncate max-w-[110px] text-muted-foreground pl-2" title={hd.domain}>
                                  {hd.domain}
                                </span>

                                {hasCloudflare ? (
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={(e) => handleToggleProxy(e, hd.domain, isProxied)}
                                    className={cn(
                                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border cursor-pointer',
                                      isProxied
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted',
                                      isUpdating && 'opacity-60 pointer-events-none',
                                    )}
                                    title={isProxied ? 'Cloudflare Proxy & Security Active' : 'DNS Only (Direct Origin)'}
                                  >
                                    {isUpdating ? (
                                      <LoaderCircleIcon className="size-2.5 animate-spin" />
                                    ) : isProxied ? (
                                      <ShieldCheckIcon className="size-2.5 text-emerald-500" />
                                    ) : (
                                      <ShieldAlertIcon className="size-2.5 text-muted-foreground" />
                                    )}
                                    <span>{isProxied ? 'Protected' : 'DNS only'}</span>
                                  </button>
                                ) : (
                                  <span
                                    className={cn(
                                      'size-1.5 rounded-full shrink-0',
                                      hd.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500',
                                    )}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground pl-2 italic">
                          No custom domains added
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-2 py-1 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'size-1.5 rounded-full shrink-0',
                            isPrimaryProxied ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                          )}
                        />
                        <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[120px]" title={site.domain}>
                          {site.domain}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasCloudflare && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.5 rounded border',
                              isPrimaryProxied
                                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                : 'text-muted-foreground bg-muted/40 border-border/50',
                            )}
                          >
                            {isPrimaryProxied ? <ShieldCheckIcon className="size-2.5" /> : <ShieldAlertIcon className="size-2.5" />}
                            {isPrimaryProxied ? 'Proxy' : 'DNS'}
                          </span>
                        )}
                        {customDomains.length > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            +{customDomains.length}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting line 1 */}
              <div className="hidden lg:flex items-center justify-center w-8 relative select-none">
                <svg className="w-full h-20 overflow-visible" viewBox="0 0 32 80" fill="none" preserveAspectRatio="none">
                  <path
                    d="M 0 20 H 16 V 60 H 0 M 16 40 H 32"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-border hover:text-primary transition-colors"
                  />
                </svg>
              </div>

              {/* Column 2: App server & Queues */}
              <div className="rounded-xl border border-border/50 bg-muted/15 p-3 flex flex-col gap-2.5 relative z-10">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-0.5">
                  <span className="truncate">{regionLabel}</span>
                </div>

                <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ServerIcon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">App server</span>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {site.status || 'Ready'}
                    </span>
                  </div>

                  {isDetailed && (
                    <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <ServerIcon className="size-3 text-muted-foreground/70" />
                          <span>Host</span>
                        </span>
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {server.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <CpuIcon className="size-3 text-muted-foreground/70" />
                          <span>Runtime</span>
                        </span>
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {site.php_version ? `PHP ${site.php_version}` : site.type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <GlobeIcon className="size-3 text-muted-foreground/70" />
                          <span>Web server</span>
                        </span>
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {site.webserver || 'Nginx'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <CpuIcon className="size-3 text-muted-foreground/70" />
                          <span>IP</span>
                        </span>
                        <span className="font-mono text-[11px] font-medium text-foreground">
                          {server.ip}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers3Icon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">Queues & Cron</span>
                    </div>
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                  </div>

                  {isDetailed ? (
                    <div className="mt-2.5 space-y-1 border-t border-border/40 pt-2.5 text-xs">
                      <div className="group flex items-center rounded-sm -mx-1 px-1 py-0.5 hover:bg-accent/60 transition-colors">
                        <Link
                          href={route('workers.site', { server: server.id, site: site.id })}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <CpuIcon className="size-3 text-muted-foreground/70" />
                            <span>Workers</span>
                          </span>
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {workersCount}
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label="Create worker"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dialog.workerForm.open({ serverId: server.id, site });
                          }}
                          className="text-muted-foreground hover:bg-accent hover:text-foreground ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                        >
                          <PlusIcon className="size-3" />
                        </button>
                      </div>

                      <div className="group flex items-center rounded-sm -mx-1 px-1 py-0.5 hover:bg-accent/60 transition-colors">
                        <Link
                          href={route('cronjobs.site', { server: server.id, site: site.id })}
                          className="flex min-w-0 flex-1 items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <Layers3Icon className="size-3 text-muted-foreground/70" />
                            <span>Crons</span>
                          </span>
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {cronJobsCount}
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label="Create cron job"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dialog.cronjobForm.open({ serverId: server.id, site });
                          }}
                          className="text-muted-foreground hover:bg-accent hover:text-foreground ml-1 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                        >
                          <PlusIcon className="size-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Link href={route('workers.site', { server: server.id, site: site.id })} className="hover:text-foreground hover:underline">
                          {workersCount} {workersCount === 1 ? 'Worker' : 'Workers'}
                        </Link>
                        <button
                          type="button"
                          aria-label="Create worker"
                          onClick={() => dialog.workerForm.open({ serverId: server.id, site })}
                          className="hover:bg-accent hover:text-foreground rounded p-0.5 cursor-pointer"
                        >
                          <PlusIcon className="size-2.5" />
                        </button>
                      </span>
                      <span className="flex items-center gap-1">
                        <Link href={route('cronjobs.site', { server: server.id, site: site.id })} className="hover:text-foreground hover:underline">
                          {cronJobsCount} {cronJobsCount === 1 ? 'Cron' : 'Crons'}
                        </Link>
                        <button
                          type="button"
                          aria-label="Create cron job"
                          onClick={() => dialog.cronjobForm.open({ serverId: server.id, site })}
                          className="hover:bg-accent hover:text-foreground rounded p-0.5 cursor-pointer"
                        >
                          <PlusIcon className="size-2.5" />
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting line 2 */}
              <div className="hidden lg:flex items-center justify-center w-8 relative select-none">
                <svg className="w-full h-28 overflow-visible" viewBox="0 0 32 100" fill="none" preserveAspectRatio="none">
                  <path
                    d="M 0 25 H 16 V 80 H 32 M 16 25 H 32 M 16 52.5 H 32 M 0 52.5 H 16"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-border hover:text-primary transition-colors"
                  />
                </svg>
              </div>

              {/* Column 3: Connected Resources */}
              <div className="rounded-xl border border-border/50 bg-muted/15 p-3 flex flex-col gap-2.5 relative z-10">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-0.5">
                  <span>Resources</span>
                  <Link href={resourcesUrl} className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1">
                    <PlusIcon className="size-2.5" />
                    <span>Manage</span>
                  </Link>
                </div>

                {/* Database Resource */}
                {dbResource ? (
                  <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <DatabaseIcon className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-semibold text-foreground">Database</span>
                          <span className="text-[11px] text-muted-foreground font-normal truncate">
                            {dbResource.server?.name || dbResource.server?.ip || 'Attached'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedResource(dbResource)}
                      >
                        <KeyIcon className="size-3" />
                      </Button>
                    </div>

                    {isDetailed && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <ServerIcon className="size-3 text-muted-foreground/70" />
                            <span>Server</span>
                          </span>
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {dbResource.server?.name || dbResource.server?.ip || 'Local'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <ZapIcon className="size-3 text-muted-foreground/70" />
                            <span>Status</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {dbResource.status === 'ready' ? 'Connected' : dbResource.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={resourcesUrl}
                    className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-2.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <DatabaseIcon className="size-3.5" />
                      <span>Database</span>
                    </div>
                    <span className="text-primary text-[11px] font-medium flex items-center gap-0.5">
                      <PlusIcon className="size-2.5" />
                      Attach
                    </span>
                  </Link>
                )}

                {/* Cache Resource */}
                {cacheResource ? (
                  <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <ZapIcon className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-semibold text-foreground">Cache</span>
                          <span className="text-[11px] text-muted-foreground font-normal truncate">
                            {cacheResource.server?.name || cacheResource.server?.ip || 'Attached'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedResource(cacheResource)}
                      >
                        <KeyIcon className="size-3" />
                      </Button>
                    </div>

                    {isDetailed && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <ServerIcon className="size-3 text-muted-foreground/70" />
                            <span>Server</span>
                          </span>
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {cacheResource.server?.name || cacheResource.server?.ip || 'Local'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <ZapIcon className="size-3 text-muted-foreground/70" />
                            <span>Status</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {cacheResource.status === 'ready' ? 'Connected' : cacheResource.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={resourcesUrl}
                    className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-2.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <ZapIcon className="size-3.5" />
                      <span>Cache / Redis</span>
                    </div>
                    <span className="text-primary text-[11px] font-medium flex items-center gap-0.5">
                      <PlusIcon className="size-2.5" />
                      Attach
                    </span>
                  </Link>
                )}

                {/* Storage Resource */}
                {storageResource ? (
                  <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <HardDriveIcon className="size-4 text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-semibold text-foreground">Storage</span>
                          <span className="text-[11px] text-muted-foreground font-normal truncate">
                            {storageResource.storage_provider?.name || 'Attached'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedResource(storageResource)}
                      >
                        <KeyIcon className="size-3" />
                      </Button>
                    </div>

                    {isDetailed && (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/40 pt-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <HardDriveIcon className="size-3 text-muted-foreground/70" />
                            <span>Provider</span>
                          </span>
                          <span className="font-mono text-[11px] font-medium text-foreground">
                            {storageResource.storage_provider?.name || 'S3 Storage'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                            <ZapIcon className="size-3 text-muted-foreground/70" />
                            <span>Status</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            {storageResource.status === 'ready' ? 'Connected' : storageResource.status}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    href={resourcesUrl}
                    className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-2.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <HardDriveIcon className="size-3.5" />
                      <span>Object Storage</span>
                    </div>
                    <span className="text-primary text-[11px] font-medium flex items-center gap-0.5">
                      <PlusIcon className="size-2.5" />
                      Attach
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>

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

        <EdgeNetworkDialog
          open={isEdgeDialogOpen}
          onOpenChange={setIsEdgeDialogOpen}
          site={site}
          server={server}
          dnsProviders={dnsProviders}
          hostedDomains={hostedDomains}
          domainProxyStatus={domainProxyStatus}
        />
      </Card>
    </Collapsible>
  );
}
