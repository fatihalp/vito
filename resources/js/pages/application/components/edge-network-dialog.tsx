import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DNSProvider } from '@/types/dns-provider';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { HostedDomain } from '@/types/hosted-domain';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
  CloudIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  PlusIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialog } from '@/hooks/use-dialog';

interface EdgeNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site;
  server: Server;
  dnsProviders: DNSProvider[];
  hostedDomains?: HostedDomain[];
  domainProxyStatus?: Record<string, boolean>;
}

type DomainRow = { domain: string; type: HostedDomain['type'] };

export default function EdgeNetworkDialog({
  open,
  onOpenChange,
  site,
  server,
  dnsProviders = [],
  hostedDomains = [],
  domainProxyStatus = {},
}: EdgeNetworkDialogProps) {
  const dialog = useDialog();
  const [togglingDomain, setTogglingDomain] = useState<string | null>(null);

  const connectedCloudflare = dnsProviders.find((p) => p.connected && p.provider === 'cloudflare');
  const hasCloudflare = Boolean(connectedCloudflare);

  const domains = Object.values(
    [{ domain: site.domain, type: 'primary' as const }, ...hostedDomains].reduce<Record<string, DomainRow>>((acc, item) => {
      const existing = acc[item.domain];
      if (!existing || item.type === 'primary') {
        acc[item.domain] = { domain: item.domain, type: item.type };
      }
      return acc;
    }, {}),
  ).sort((a, b) => (a.type === 'primary' ? -1 : b.type === 'primary' ? 1 : a.domain.localeCompare(b.domain)));

  const protectedCount = domains.filter((d) => domainProxyStatus[d.domain] ?? hasCloudflare).length;

  const handleToggleProxy = (domainName: string, currentStatus: boolean) => {
    setTogglingDomain(domainName);
    router.post(
      route('sites.toggle-domain-proxy', { server: server.id, site: site.id }),
      { domain: domainName, proxied: !currentStatus },
      { preserveScroll: true, onFinish: () => setTogglingDomain(null) },
    );
  };

  const openCloudflareEdit = () => {
    if (connectedCloudflare) {
      onOpenChange(false);
      dialog.dnsProviderEdit.open({ dnsProvider: connectedCloudflare });
    }
  };

  const openAddDomain = () => {
    onOpenChange(false);
    dialog.createHostedDomain.open({ site });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl p-6" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20">
                <CloudIcon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-base font-semibold">Edge Network & Security</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Edge proxy and CDN settings for <span className="font-mono font-medium text-foreground">{site.domain}</span>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Links Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0 self-start sm:self-auto text-xs">
                  <SettingsIcon className="size-3.5" />
                  <span>Links & Manage</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Management
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={route('hosted-domains', { server: server.id, site: site.id })} className="flex items-center gap-2 cursor-pointer text-xs">
                    <GlobeIcon className="size-3.5 text-muted-foreground" />
                    <span>Manage Domains</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={route('dns-providers')} className="flex items-center gap-2 cursor-pointer text-xs">
                    <SettingsIcon className="size-3.5 text-muted-foreground" />
                    <span>DNS Providers</span>
                  </Link>
                </DropdownMenuItem>
                {hasCloudflare && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a
                        href="https://dash.cloudflare.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between cursor-pointer text-xs"
                      >
                        <span className="flex items-center gap-2">
                          <CloudIcon className="size-3.5 text-orange-500" />
                          <span>Cloudflare Dashboard</span>
                        </span>
                        <ExternalLinkIcon className="size-3 text-muted-foreground" />
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider Status Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex size-10 items-center justify-center rounded-lg bg-background border shadow-xs">
                <CloudIcon className={cn('size-5', hasCloudflare ? 'text-orange-500' : 'text-muted-foreground')} />
                <span
                  className={cn(
                    'absolute -top-1 -right-1 size-3 rounded-full border-2 border-background',
                    hasCloudflare ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {hasCloudflare ? connectedCloudflare?.name || 'Cloudflare' : 'No Edge Provider'}
                  </span>
                  <Badge variant={hasCloudflare ? 'default' : 'outline'} className="text-[11px] font-normal">
                    {hasCloudflare ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasCloudflare
                    ? 'DDoS protection & CDN caching active'
                    : 'Traffic reaches server directly without edge proxy'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasCloudflare ? (
                <Button variant="outline" size="sm" onClick={openCloudflareEdit} className="text-xs">
                  <SettingsIcon className="size-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild className="text-xs">
                  <Link href={route('dns-providers')}>Connect Cloudflare</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Domains Section */}
          <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between bg-muted/40 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <GlobeIcon className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Domains</span>
                <Badge variant="secondary" className="text-[11px] font-mono font-normal">
                  {hasCloudflare ? `${protectedCount} of ${domains.length} protected` : `${domains.length} total`}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={openAddDomain} className="h-8 text-xs gap-1">
                <PlusIcon className="size-3.5" />
                <span>Add Domain</span>
              </Button>
            </div>

            <div className="divide-y">
              {domains.map((item) => {
                const isProxied = domainProxyStatus[item.domain] ?? hasCloudflare;
                const isUpdating = togglingDomain === item.domain;

                return (
                  <div key={item.domain} className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-muted/10 transition-colors">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: isProxied ? '#10b981' : '#94a3b8' }}
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm font-medium truncate" title={item.domain}>
                          {item.domain}
                        </span>
                        <Badge variant={item.type === 'primary' ? 'default' : 'outline'} className="text-[10px] uppercase font-semibold">
                          {item.type}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {hasCloudflare ? (
                        <Button
                          type="button"
                          variant={isProxied ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={isUpdating}
                          onClick={() => handleToggleProxy(item.domain, isProxied)}
                          className={cn(
                            'h-8 gap-1.5 px-3 text-xs transition-all',
                            isProxied
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'text-muted-foreground',
                          )}
                        >
                          {isUpdating ? (
                            <LoaderCircleIcon className="size-3.5 animate-spin" />
                          ) : isProxied ? (
                            <ShieldCheckIcon className="size-3.5 text-emerald-500" />
                          ) : (
                            <ShieldAlertIcon className="size-3.5 text-muted-foreground" />
                          )}
                          <span>{isProxied ? 'Protected' : 'DNS only'}</span>
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Direct
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
