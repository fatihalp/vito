import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DNSProvider } from '@/types/dns-provider';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { HostedDomain } from '@/types/hosted-domain';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { BoxesIcon, ExternalLinkIcon, GlobeIcon, LoaderCircleIcon, PlusIcon, SettingsIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react';
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg border">
              <BoxesIcon className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <DialogTitle>Edge Network & Security</DialogTitle>
              <DialogDescription>Cloudflare proxy, DDoS protection and CDN for {site.domain}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('size-2.5 shrink-0 rounded-full', hasCloudflare ? 'bg-success' : 'bg-muted-foreground/50')} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{hasCloudflare ? connectedCloudflare?.name || 'Cloudflare' : 'No edge provider'}</span>
                <span className="text-muted-foreground text-sm">
                  {hasCloudflare ? 'DDoS protection & CDN available' : 'Traffic reaches the server directly without a proxy'}
                </span>
              </div>
            </div>
            {hasCloudflare ? (
              <Button variant="outline" size="sm" onClick={openCloudflareEdit}>
                <SettingsIcon className="size-4" />
                Edit
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href={route('dns-providers')}>Connect Cloudflare</Link>
              </Button>
            )}
          </div>

          <div className="rounded-lg border">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="font-medium">Domains</span>
              <span className="text-muted-foreground text-sm">
                {hasCloudflare ? `${protectedCount} of ${domains.length} protected` : `${domains.length} ${domains.length === 1 ? 'domain' : 'domains'}`}
              </span>
            </div>
            <div className="divide-y">
              {domains.map((item) => {
                const isProxied = domainProxyStatus[item.domain] ?? hasCloudflare;
                const isUpdating = togglingDomain === item.domain;

                return (
                  <div key={item.domain} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <GlobeIcon className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate font-mono text-sm" title={item.domain}>
                        {item.domain}
                      </span>
                      <Badge variant={item.type === 'primary' ? 'default' : 'outline'} className="shrink-0 capitalize">
                        {item.type}
                      </Badge>
                    </div>

                    {hasCloudflare ? (
                      <Button
                        type="button"
                        variant={isProxied ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => handleToggleProxy(item.domain, isProxied)}
                        className={cn('w-32 justify-start', isProxied && 'text-success')}
                        title={isProxied ? 'Disable Cloudflare proxy' : 'Enable Cloudflare proxy'}
                      >
                        {isUpdating ? (
                          <LoaderCircleIcon className="size-4 animate-spin" />
                        ) : isProxied ? (
                          <ShieldCheckIcon className="size-4" />
                        ) : (
                          <ShieldAlertIcon className="size-4" />
                        )}
                        {isProxied ? 'Protected' : 'DNS only'}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">Direct</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-4">
            <Button variant="outline" className="justify-start" onClick={openAddDomain}>
              <PlusIcon className="size-4" />
              Add domain
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={route('hosted-domains', { server: server.id, site: site.id })}>
                <GlobeIcon className="size-4" />
                Manage domains
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href={route('dns-providers')}>
                <SettingsIcon className="size-4" />
                DNS providers
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-4" />
                Cloudflare
              </a>
            </Button>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
