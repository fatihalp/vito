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
import { Switch } from '@/components/ui/switch';
import { DNSProvider } from '@/types/dns-provider';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { HostedDomain } from '@/types/hosted-domain';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  PlusIcon,
  SettingsIcon,
} from 'lucide-react';
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-6" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-semibold">Edge Network &amp; Security</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Edge proxy and CDN settings for <span className="font-mono font-medium text-foreground">{site.domain}</span>
              </DialogDescription>
            </div>

            {/* Quick Links Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 shrink-0 text-xs">
                  <SettingsIcon className="size-3.5" />
                  <span>Links &amp; Manage</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                        <span>Cloudflare Dashboard</span>
                        <ExternalLinkIcon className="size-3 text-muted-foreground ml-2" />
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider Status Summary Card */}
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 px-4 py-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {hasCloudflare ? connectedCloudflare?.name || 'Cloudflare' : 'No Edge Provider'}
                </span>
                <Badge variant={hasCloudflare ? 'default' : 'outline'} className="text-[10px] h-4 px-1.5 font-normal">
                  {hasCloudflare ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasCloudflare
                  ? 'DDoS protection & CDN caching active'
                  : 'Traffic reaches server directly without edge proxy'}
              </p>
            </div>

            <div className="shrink-0">
              {hasCloudflare ? (
                <Button variant="outline" size="sm" onClick={openCloudflareEdit} className="h-8 text-xs">
                  <SettingsIcon className="size-3.5 mr-1" />
                  Edit
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                  <Link href={route('dns-providers')}>Connect Cloudflare</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Domains Section */}
          <div className="rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between bg-muted/30 px-4 py-2.5 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">Domains</span>
                <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                  {hasCloudflare ? `${protectedCount} of ${domains.length} protected` : `${domains.length} total`}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={openAddDomain} className="h-7 text-xs px-2.5 gap-1">
                <PlusIcon className="size-3" />
                <span>Add Domain</span>
              </Button>
            </div>

            <div className="divide-y divide-border/50">
              {domains.map((item) => {
                const isProxied = domainProxyStatus[item.domain] ?? hasCloudflare;
                const isUpdating = togglingDomain === item.domain;

                return (
                  <div key={item.domain} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/10 transition-colors">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="font-mono text-xs font-medium text-foreground truncate" title={item.domain}>
                        {item.domain}
                      </span>
                      {item.type === 'primary' && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 uppercase font-semibold">
                          Primary
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {hasCloudflare ? (
                        <div className="flex items-center gap-2.5">
                          {isUpdating && <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />}
                          <span className={isProxied ? 'text-xs font-medium text-foreground' : 'text-xs text-muted-foreground'}>
                            {isProxied ? 'Protected' : 'DNS only'}
                          </span>
                          <Switch
                            checked={isProxied}
                            disabled={isUpdating}
                            onCheckedChange={() => handleToggleProxy(item.domain, isProxied)}
                            aria-label={`Toggle protection for ${item.domain}`}
                          />
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
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
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
