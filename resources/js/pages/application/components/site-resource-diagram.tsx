import { useState, useRef } from 'react';
import { Link, router } from '@inertiajs/react';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { SiteResource } from '@/types/site-resource';
import { HostedDomain } from '@/types/hosted-domain';
import { DNSProvider } from '@/types/dns-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  GlobeIcon,
  DatabaseIcon,
  ZapIcon,
  HardDriveIcon,
  ServerIcon,
  PlusIcon,
  ArrowRightIcon,
  LayersIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  InfoIcon,
  Layers3Icon,
  CpuIcon,
  BoxesIcon,
  Rows3Icon,
  CreditCardIcon,
  KeyIcon,
  RadioIcon,
  LockIcon,
  SettingsIcon,
  LoaderCircleIcon,
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
  const bucketResource = resources.find((r) => r.type_value === 'bucket');

  const resourcesUrl = route('site-resources', { server: server.id, site: site.id });

  
  const connectedCloudflare = dnsProviders.find((p) => p.connected && p.provider === 'cloudflare');
  const hasCloudflare = Boolean(connectedCloudflare);
  const anyConnectedDns = dnsProviders.some((p) => p.connected);

  
  const customDomains = hostedDomains.filter(
    (hd) => hd.domain.toLowerCase() !== site.domain.toLowerCase() && hd.type !== 'primary',
  );

  const regionLabel = server.provider || 'Host Infrastructure';

  return (
    <Card ref={containerRef} className="relative overflow-hidden border-border/60 shadow-xs transition-all duration-300">
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
          {}
          <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/60">
            <button
              type="button"
              onClick={() => toggleMode(false)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                !isDetailed
                  ? 'bg-card text-foreground shadow-xs border border-border/60 font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Rows3Icon className="size-3.5" />
              <span>Simple</span>
            </button>
            <button
              type="button"
              onClick={() => toggleMode(true)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                isDetailed
                  ? 'bg-card text-foreground shadow-xs border border-border/60 font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <CreditCardIcon className="size-3.5" />
              <span>Detailed</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
            onClick={() => dialog.createHostedDomain.open({ site })}
          >
            <PlusIcon className="size-3.5" />
            <span>Add Domain</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground border-border/60"
          >
            <Link href={resourcesUrl}>
              Resources
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative p-5 md:p-8 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:16px_16px] pb-16 transition-all duration-300">
        
        {}
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1.15fr_auto_1.25fr] items-start gap-4 lg:gap-0">
          
          {}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-3.5 sm:p-4 flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
              <span>Network</span>
              <InfoIcon className="size-3.5 text-muted-foreground/60" />
            </div>

            {}
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsEdgeDialogOpen(true)}
                  className="flex items-center gap-2.5 text-left group"
                >
                  <BoxesIcon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Edge network</span>
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEdgeDialogOpen(true)}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/40 hover:border-border transition-colors"
                  >
                    <span className={cn('size-1.5 rounded-full', hasCloudflare ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                    {hasCloudflare ? 'Cloudflare' : anyConnectedDns ? 'DNS' : 'Direct'}
                    <SettingsIcon className="size-2.5 opacity-60 ml-0.5" />
                  </button>
                </div>
              </div>

              {isDetailed && (
                <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsEdgeDialogOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ShieldCheckIcon className="size-3.5 text-muted-foreground/70" />
                      <span>DDoS protection</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className={cn('size-1.5 rounded-full', hasCloudflare ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {hasCloudflare ? 'Active (Cloudflare)' : 'Origin Shield'}
                    </span>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsEdgeDialogOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <RadioIcon className="size-3.5 text-muted-foreground/70" />
                      <span>CDN & Routing</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className={cn('size-1.5 rounded-full', hasCloudflare ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {hasCloudflare ? 'Edge Proxied' : 'DNS Direct (80/443)'}
                    </span>
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsEdgeDialogOpen(true)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEdgeDialogOpen(true)}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/20 p-1 -mx-1 rounded-md transition-colors"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <LockIcon className="size-3.5 text-muted-foreground/70" />
                      <span>Edge SSL / TLS</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <span className={cn('size-1.5 rounded-full', site.ssl_enabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {site.ssl_enabled ? 'Strict HTTPS' : 'Disabled'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <GlobeIcon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Domains</span>
                </div>
                <button
                  type="button"
                  onClick={() => dialog.createHostedDomain.open({ site })}
                  className="text-primary hover:underline flex items-center gap-1 font-medium text-[11px]"
                >
                  <PlusIcon className="size-3" />
                  <span>Add domain</span>
                </button>
              </div>

              {isDetailed ? (
                <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                  {}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-mono text-[11px] font-medium text-foreground truncate max-w-[120px]" title={site.domain}>
                        {site.domain}
                      </span>
                    </span>

                    {hasCloudflare ? (
                      <button
                        type="button"
                        disabled={togglingDomain === site.domain}
                        onClick={(e) => handleToggleProxy(e, site.domain, domainProxyStatus[site.domain] ?? true)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors border',
                          (domainProxyStatus[site.domain] ?? true)
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted',
                          togglingDomain === site.domain && 'opacity-60 pointer-events-none',
                        )}
                        title={(domainProxyStatus[site.domain] ?? true) ? 'Cloudflare Proxy & Security Active' : 'DNS Only (Direct Origin)'}
                      >
                        {togglingDomain === site.domain ? (
                          <LoaderCircleIcon className="size-2.5 animate-spin" />
                        ) : (domainProxyStatus[site.domain] ?? true) ? (
                          <ShieldCheckIcon className="size-2.5 text-emerald-500" />
                        ) : (
                          <ShieldAlertIcon className="size-2.5 text-muted-foreground" />
                        )}
                        <span>{(domainProxyStatus[site.domain] ?? true) ? 'Protected' : 'DNS Direct'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">Direct</span>
                    )}
                  </div>

                  {}
                  {customDomains.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-border/30">
                      {customDomains.map((hd) => {
                        const isProxied = domainProxyStatus[hd.domain] ?? true;
                        const isUpdating = togglingDomain === hd.domain;

                        return (
                          <div key={hd.id} className="flex items-center justify-between text-[11px] font-mono">
                            <span className="truncate max-w-[110px] text-muted-foreground pl-3" title={hd.domain}>
                              {hd.domain}
                            </span>

                            {hasCloudflare ? (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={(e) => handleToggleProxy(e, hd.domain, isProxied)}
                                className={cn(
                                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border',
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
                                <span>{isProxied ? 'Protected' : 'DNS Direct'}</span>
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
                    <div className="text-[11px] text-muted-foreground pl-3 italic">
                      No custom domains added
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono text-xs font-medium text-foreground truncate max-w-[130px]" title={site.domain}>
                      {site.domain}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasCloudflare && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <ShieldCheckIcon className="size-2.5" />
                        {(domainProxyStatus[site.domain] ?? true) ? 'Proxy' : 'DNS'}
                      </span>
                    )}
                    {customDomains.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        +{customDomains.length} alias
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {}
          <div className="hidden lg:flex items-center justify-center w-10 relative select-none">
            <svg className="w-full h-24 overflow-visible" viewBox="0 0 40 100" fill="none" preserveAspectRatio="none">
              <path
                d="M 0 25 H 20 V 75 H 0 M 20 50 H 40"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-border hover:text-primary transition-colors"
              />
            </svg>
          </div>

          {}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-3.5 sm:p-4 flex flex-col gap-3 relative z-10">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
              <span>{regionLabel}</span>
            </div>

            {}
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ServerIcon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">App server</span>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {site.status || 'Ready'}
                </span>
              </div>

              {isDetailed && (
                <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ServerIcon className="size-3.5 text-muted-foreground/70" />
                      <span>Host server</span>
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {server.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CpuIcon className="size-3.5 text-muted-foreground/70" />
                      <span>Runtime</span>
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {site.php_version ? `PHP ${site.php_version}` : site.type}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <GlobeIcon className="size-3.5 text-muted-foreground/70" />
                      <span>Web server</span>
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {site.webserver || 'Nginx'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CpuIcon className="size-3.5 text-muted-foreground/70" />
                      <span>Public IP</span>
                    </span>
                    <span className="font-mono text-xs font-medium text-foreground">
                      {server.ip}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {}
            <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers3Icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Queues & Cron</span>
                </div>
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </div>

              {isDetailed ? (
                <div className="mt-3.5 space-y-1 border-t border-border/40 pt-3 text-xs">
                  <div className="group flex items-center rounded-sm -mx-1 px-1 py-0.5 hover:bg-accent/60 transition-colors">
                    <Link
                      href={route('workers.site', { server: server.id, site: site.id })}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <CpuIcon className="size-3.5 text-muted-foreground/70" />
                        <span>Background workers</span>
                      </span>
                      <span className="font-mono text-xs font-medium text-foreground">
                        {workersCount} {workersCount === 1 ? 'worker' : 'workers'}
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
                      className="text-muted-foreground hover:bg-accent hover:text-foreground ml-1.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </div>

                  <div className="group flex items-center rounded-sm -mx-1 px-1 py-0.5 hover:bg-accent/60 transition-colors">
                    <Link
                      href={route('cronjobs.site', { server: server.id, site: site.id })}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Layers3Icon className="size-3.5 text-muted-foreground/70" />
                        <span>Scheduled crons</span>
                      </span>
                      <span className="font-mono text-xs font-medium text-foreground">
                        {cronJobsCount} {cronJobsCount === 1 ? 'task' : 'tasks'}
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
                      className="text-muted-foreground hover:bg-accent hover:text-foreground ml-1.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <PlusIcon className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Link href={route('workers.site', { server: server.id, site: site.id })} className="hover:text-foreground hover:underline">
                      {workersCount} {workersCount === 1 ? 'Worker' : 'Workers'}
                    </Link>
                    <button
                      type="button"
                      aria-label="Create worker"
                      onClick={() => dialog.workerForm.open({ serverId: server.id, site })}
                      className="hover:bg-accent hover:text-foreground rounded p-0.5"
                    >
                      <PlusIcon className="size-3" />
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
                      className="hover:bg-accent hover:text-foreground rounded p-0.5"
                    >
                      <PlusIcon className="size-3" />
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>

          {}
          <div className="hidden lg:flex items-center justify-center w-10 relative select-none">
            <svg className="w-full h-36 overflow-visible" viewBox="0 0 40 120" fill="none" preserveAspectRatio="none">
              <path
                d="M 0 30 H 20 V 100 H 40 M 20 30 H 40 M 20 65 H 40 M 0 65 H 20"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-border hover:text-primary transition-colors"
              />
            </svg>
          </div>

          {}
          <div className="flex flex-col gap-3 relative z-10">
            {}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
                <span>{regionLabel}</span>
              </div>

              {}
              {dbResource ? (
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <DatabaseIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-semibold text-foreground">Database</span>
                        <span className="text-xs text-muted-foreground font-normal truncate">
                          {dbResource.server?.name || dbResource.server?.ip || 'Attached'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedResource(dbResource)}
                    >
                      <KeyIcon className="size-3" />
                    </Button>
                  </div>

                  {isDetailed && (
                    <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ServerIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Server</span>
                        </span>
                        <span className="font-mono text-xs font-medium text-foreground">
                          {dbResource.server?.name || dbResource.server?.ip || 'Local'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ZapIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Status</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
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
                  className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-3.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <DatabaseIcon className="size-4" />
                    <span>Database (Not attached)</span>
                  </div>
                  <span className="text-primary font-medium flex items-center gap-1">
                    <PlusIcon className="size-3" />
                    Attach
                  </span>
                </Link>
              )}

              {}
              {cacheResource ? (
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ZapIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-semibold text-foreground">Cache</span>
                        <span className="text-xs text-muted-foreground font-normal truncate">
                          {cacheResource.server?.name || cacheResource.server?.ip || 'Attached'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedResource(cacheResource)}
                    >
                      <KeyIcon className="size-3" />
                    </Button>
                  </div>

                  {isDetailed && (
                    <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ServerIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Server</span>
                        </span>
                        <span className="font-mono text-xs font-medium text-foreground">
                          {cacheResource.server?.name || cacheResource.server?.ip || 'Local'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ZapIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Status</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
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
                  className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-3.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <ZapIcon className="size-4" />
                    <span>Cache / Redis (Not attached)</span>
                  </div>
                  <span className="text-primary font-medium flex items-center gap-1">
                    <PlusIcon className="size-3" />
                    Attach
                  </span>
                </Link>
              )}
            </div>

            {}
            <div className="rounded-2xl border border-border/50 bg-muted/15 p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
                <span>Global Storage</span>
              </div>

              {}
              {bucketResource ? (
                <div className="rounded-xl border border-border/70 bg-card p-3.5 shadow-2xs hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <HardDriveIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-semibold text-foreground">Storage Bucket</span>
                        <span className="text-xs text-muted-foreground font-normal truncate">
                          {bucketResource.bucket?.name || 'Attached'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedResource(bucketResource)}
                    >
                      <KeyIcon className="size-3" />
                    </Button>
                  </div>

                  {isDetailed && (
                    <div className="mt-3.5 space-y-2 border-t border-border/40 pt-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDriveIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Bucket name</span>
                        </span>
                        <span className="font-mono text-xs font-medium text-foreground">
                          {bucketResource.bucket?.name || 'S3 Bucket'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <ZapIcon className="size-3.5 text-muted-foreground/70" />
                          <span>Status</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {bucketResource.status === 'ready' ? 'Connected' : bucketResource.status}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={resourcesUrl}
                  className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-3.5 flex items-center justify-between text-xs transition-colors hover:border-border hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <HardDriveIcon className="size-4" />
                    <span>Object Storage (Not attached)</span>
                  </div>
                  <span className="text-primary font-medium flex items-center gap-1">
                    <PlusIcon className="size-3" />
                    Attach
                  </span>
                </Link>
              )}
            </div>
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
  );
}





