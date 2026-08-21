import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DNSProvider } from '@/types/dns-provider';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { HostedDomain } from '@/types/hosted-domain';
import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import {
  BoxesIcon,
  GlobeIcon,
  ExternalLinkIcon,
  SettingsIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  LoaderCircleIcon,
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

  const allDomains = [
    { domain: site.domain, isPrimary: true },
    ...hostedDomains.map((hd) => ({ domain: hd.domain, isPrimary: false })),
  ];

  const handleToggleProxy = (domainName: string, currentStatus: boolean) => {
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
      <DialogContent className="max-h-[90vh] sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
              <BoxesIcon className="size-4 text-foreground" />
            </div>
            <DialogTitle className="text-sm font-semibold">Edge Network & Security</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1 text-xs">
          {}
          <div className="rounded-xl border border-border/70 bg-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={cn('size-2 rounded-full', hasCloudflare ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
              <div>
                <span className="font-semibold text-foreground text-xs">
                  {hasCloudflare ? (connectedCloudflare?.name || 'Cloudflare') : 'DNS Direct'}
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  {hasCloudflare ? 'DDoS Protection & CDN active' : 'Origin connection without proxy'}
                </span>
              </div>
            </div>

            {hasCloudflare ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={openCloudflareEdit}
              >
                <SettingsIcon className="size-3" />
                Edit
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                <Link href={route('dns-providers')}>Connect</Link>
              </Button>
            )}
          </div>

          {}
          <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pb-1 border-b border-border/40">
              <span>Domain Security (Cloudflare Proxy)</span>
              <span>Status</span>
            </div>

            <div className="space-y-1.5 pt-0.5">
              {allDomains.map((item) => {
                const isProxied = domainProxyStatus[item.domain] ?? hasCloudflare;
                const isUpdating = togglingDomain === item.domain;

                return (
                  <div key={item.domain} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GlobeIcon className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-foreground truncate max-w-[170px]" title={item.domain}>
                        {item.domain}
                      </span>
                      {item.isPrimary && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded font-sans">
                          primary
                        </span>
                      )}
                    </div>

                    {hasCloudflare ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleProxy(item.domain, isProxied)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border',
                          isProxied
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted',
                          isUpdating && 'opacity-60 pointer-events-none',
                        )}
                        title={isProxied ? 'Disable Cloudflare Proxy & Security' : 'Enable Cloudflare Proxy & Security'}
                      >
                        {isUpdating ? (
                          <LoaderCircleIcon className="size-3 animate-spin" />
                        ) : isProxied ? (
                          <ShieldCheckIcon className="size-3 text-emerald-500" />
                        ) : (
                          <ShieldAlertIcon className="size-3 text-muted-foreground" />
                        )}
                        <span>{isProxied ? 'Protected' : 'DNS Only'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground">DNS Direct</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-1.5 h-8 text-xs"
              onClick={openAddDomain}
            >
              <PlusIcon className="size-3 text-primary" />
              <span>Add Domain</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="justify-start gap-1.5 h-8 text-xs"
            >
              <Link href={route('hosted-domains', { server: server.id, site: site.id })}>
                <GlobeIcon className="size-3 text-primary" />
                <span>Domains</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="justify-start gap-1.5 h-8 text-xs"
            >
              <Link href={route('dns-providers')}>
                <SettingsIcon className="size-3 text-primary" />
                <span>DNS Providers</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="justify-start gap-1.5 h-8 text-xs"
            >
              <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-3 text-primary" />
                <span>Cloudflare ↗</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <DialogClose asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
