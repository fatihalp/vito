import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CloudIcon, GlobeIcon, RefreshCwIcon, ServerIcon, UnlinkIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DNSProvider } from '@/types/dns-provider';
import ConnectDNSProvider from '@/pages/dns-providers/components/connect-dns-provider';

export type DomainPickerValue = {
  domain: string;
  dns_provider_id: string;
  provider_domain_id: string;
  create_dns_record: boolean;
  dns_record_proxied: boolean;
};

type ProviderDomain = {
  id: string;
  name: string;
  status: string;
};

export function emptyDomainPickerValue(): DomainPickerValue {
  return {
    domain: '',
    dns_provider_id: '',
    provider_domain_id: '',
    create_dns_record: true,
    dns_record_proxied: false,
  };
}

export default function DomainPicker({
  value,
  onChange,
  serverIp,
  error,
  hideLabel = false,
}: {
  value: DomainPickerValue;
  onChange: (value: DomainPickerValue) => void;
  serverIp?: string;
  error?: string;
  hideLabel?: boolean;
}) {
  const [dnsDialogOpen, setDnsDialogOpen] = useState(false);
  const [dnsProviders, setDnsProviders] = useState<DNSProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [availableDomains, setAvailableDomains] = useState<ProviderDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);

  // Dialog temporary state
  const [tempProviderId, setTempProviderId] = useState('');
  const [tempZoneId, setTempZoneId] = useState('');
  const [tempSubdomain, setTempSubdomain] = useState('');
  const [tempCreateDnsRecord, setTempCreateDnsRecord] = useState(true);
  const [tempDnsRecordProxied, setTempDnsRecordProxied] = useState(false);

  const connectedProviders = useMemo(() => dnsProviders.filter((p) => p.connected), [dnsProviders]);

  const selectedProvider = useMemo(
    () => dnsProviders.find((p) => String(p.id) === String(tempProviderId)) || null,
    [dnsProviders, tempProviderId],
  );

  const selectedZone = useMemo(
    () => availableDomains.find((d) => d.id === tempZoneId) || null,
    [availableDomains, tempZoneId],
  );

  const computedDialogDomain = useMemo(() => {
    if (!selectedZone) return '';
    const clean = tempSubdomain.trim().toLowerCase().replace(/\.+$/, '').replace(/^\.+/, '');
    if (!clean || clean === '@') {
      return selectedZone.name.toLowerCase();
    }
    return `${clean}.${selectedZone.name.toLowerCase()}`;
  }, [selectedZone, tempSubdomain]);

  const fetchDomainsForProvider = async (providerId: string, refresh = false) => {
    if (!providerId) {
      setAvailableDomains([]);
      return;
    }

    setLoadingDomains(true);
    try {
      const routeName = refresh ? 'domains.refresh' : 'domains.available';
      const response = await axios.get(route(routeName, { dnsProvider: providerId, all: 1 }));
      const domains = (response.data || []) as ProviderDomain[];
      setAvailableDomains(domains);

      if (domains.length > 0 && !tempZoneId) {
        setTempZoneId(domains[0].id);
      }
    } catch {
      setAvailableDomains([]);
    } finally {
      setLoadingDomains(false);
    }
  };

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await axios.get(route('dns-providers.json'));
      const providers = (response.data || []) as DNSProvider[];
      setDnsProviders(providers);
      const connected = providers.filter((p) => p.connected);
      if (connected.length > 0 && !tempProviderId) {
        const firstId = String(connected[0].id);
        setTempProviderId(firstId);
      }
    } catch {
      // Ignored
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const openDnsModal = () => {
    const providerId = value.dns_provider_id || (connectedProviders[0] ? String(connectedProviders[0].id) : '');
    setTempProviderId(providerId);
    setTempZoneId(value.provider_domain_id || '');
    setTempCreateDnsRecord(value.create_dns_record);
    setTempDnsRecordProxied(value.dns_record_proxied);
    if (providerId) {
      fetchDomainsForProvider(providerId);
    }
    setDnsDialogOpen(true);
  };

  const handleProviderSelect = (providerId: string) => {
    setTempProviderId(providerId);
    setTempZoneId('');
    fetchDomainsForProvider(providerId);
  };

  const handleApplyDns = () => {
    if (!computedDialogDomain) return;
    onChange({
      domain: computedDialogDomain,
      dns_provider_id: tempProviderId,
      provider_domain_id: tempZoneId,
      create_dns_record: tempCreateDnsRecord,
      dns_record_proxied: tempDnsRecordProxied,
    });
    setDnsDialogOpen(false);
  };

  const activeProviderName = useMemo(() => {
    if (!value.dns_provider_id) return null;
    const provider = dnsProviders.find((p) => String(p.id) === String(value.dns_provider_id));
    return provider ? `${provider.name} (${provider.provider})` : 'DNS Provider';
  }, [dnsProviders, value.dns_provider_id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {!hideLabel && <Label htmlFor="domain">Domain</Label>}
        {connectedProviders.length > 0 && (
          <button
            type="button"
            onClick={openDnsModal}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-normal cursor-pointer"
          >
            <CloudIcon className="size-3.5" />
            <span>From Cloudflare / DNS Provider</span>
          </button>
        )}
      </div>

      <Input
        id="domain"
        name="domain"
        value={value.domain}
        onChange={(e) => {
          const newDomain = e.target.value;
          onChange({
            ...value,
            domain: newDomain,
            dns_provider_id: '',
            provider_domain_id: '',
            create_dns_record: false,
            dns_record_proxied: false,
          });
        }}
        placeholder="example.com or app.example.com"
      />

      {value.dns_provider_id && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground border">
          <div className="flex items-center gap-2">
            <CloudIcon className="size-4 text-primary shrink-0" />
            <span>
              Connected to <strong className="text-foreground">{activeProviderName}</strong>
              {value.create_dns_record && ' • Auto A-record'}
              {value.dns_record_proxied && ' • Cloudflare Proxy'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...emptyDomainPickerValue(), domain: value.domain })}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline ml-2 cursor-pointer"
          >
            <UnlinkIcon className="size-3" />
            Unlink
          </button>
        </div>
      )}

      <InputError message={error} />

      {/* DNS Provider Modal Dialog */}
      <Dialog open={dnsDialogOpen} onOpenChange={setDnsDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-xl overflow-hidden rounded-xl">
          <DialogHeader className="border-b px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <CloudIcon className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">Select from DNS Provider</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Select a domain managed by your DNS provider to automatically configure DNS records for this site.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 p-6">
            {connectedProviders.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="dns_provider_modal_id" className="text-xs font-medium">
                  DNS Provider
                </Label>
                <div className="flex items-center gap-2">
                  <Select value={tempProviderId} onValueChange={handleProviderSelect}>
                    <SelectTrigger id="dns_provider_modal_id" className="h-9">
                      <SelectValue placeholder={loadingProviders ? 'Loading providers...' : 'Select DNS Provider'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {connectedProviders.map((provider) => (
                          <SelectItem key={provider.id} value={String(provider.id)}>
                            {provider.name} ({provider.provider})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <ConnectDNSProvider onProviderAdded={fetchProviders}>
                    <Button variant="outline" size="icon" type="button" className="h-9 w-9 shrink-0" aria-label="Connect DNS Provider">
                      <CloudIcon className="size-4" />
                    </Button>
                  </ConnectDNSProvider>
                </div>
              </div>
            )}

            {/* Subdomain (First) and Domain/Zone (Second) */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Subdomain on the left (col-span-5) */}
                <div className="sm:col-span-5 space-y-1.5">
                  <Label htmlFor="subdomain_modal" className="text-xs font-medium flex items-center justify-between">
                    <span>Subdomain</span>
                    <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                  </Label>
                  <Input
                    type="text"
                    id="subdomain_modal"
                    value={tempSubdomain}
                    onChange={(e) => setTempSubdomain(e.target.value)}
                    placeholder="e.g. app, api, or @"
                    className="h-9 font-mono text-xs"
                  />
                </div>

                {/* Dot separator on desktop */}
                <div className="hidden sm:flex sm:col-span-1 items-center justify-center pb-2 text-muted-foreground font-bold text-lg select-none">
                  .
                </div>

                {/* Domain / Zone on the right (col-span-6) */}
                <div className="sm:col-span-6 space-y-1.5">
                  <Label htmlFor="provider_zone_id" className="text-xs font-medium">
                    Domain / Zone
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={tempZoneId}
                      onValueChange={setTempZoneId}
                      disabled={!tempProviderId || loadingDomains}
                    >
                      <SelectTrigger id="provider_zone_id" className="h-9 flex-1">
                        <SelectValue placeholder={loadingDomains ? 'Loading domains...' : 'Select a domain'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {availableDomains.map((domain) => (
                            <SelectItem key={domain.id} value={domain.id}>
                              <div className="flex items-center gap-2">
                                <GlobeIcon className="size-3.5 text-muted-foreground shrink-0" />
                                <span className="font-mono text-xs">{domain.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      className="h-9 w-9 shrink-0"
                      disabled={loadingDomains || !tempProviderId}
                      onClick={() => fetchDomainsForProvider(tempProviderId, true)}
                      title="Refresh domain list"
                    >
                      <RefreshCwIcon className={cn('size-3.5', loadingDomains && 'animate-spin')} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Result Preview Box */}
            {computedDialogDomain && (
              <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Site Domain:</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground bg-background px-2.5 py-1 rounded-md border shadow-2xs">
                    <GlobeIcon className="size-3.5 text-primary shrink-0" />
                    <span>{computedDialogDomain}</span>
                  </div>
                </div>

                {tempCreateDnsRecord && serverIp && (
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ServerIcon className="size-3.5" />
                      <span>DNS A Record:</span>
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                      <span>{computedDialogDomain}</span>
                      <span>&rarr;</span>
                      <span className="font-semibold text-foreground">{serverIp}</span>
                      {tempDnsRecordProxied && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-orange-600 dark:text-orange-400 border-orange-500/30 ml-1">
                          Proxied
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checkbox Options */}
            <div className="space-y-2.5 pt-1">
              <label
                htmlFor="modal_create_dns_record"
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none',
                  tempCreateDnsRecord ? 'bg-primary/5 border-primary/30' : 'bg-muted/20 hover:bg-muted/40'
                )}
              >
                <Checkbox
                  id="modal_create_dns_record"
                  checked={tempCreateDnsRecord}
                  onCheckedChange={(checked) => setTempCreateDnsRecord(Boolean(checked))}
                  className="mt-0.5"
                />
                <div className="grid gap-1">
                  <span className="text-xs font-medium leading-none text-foreground">
                    Automatically create an A record
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Points <span className="font-mono text-foreground">{computedDialogDomain || 'domain'}</span> at server IP
                    {serverIp ? <> (<span className="font-mono text-foreground font-medium">{serverIp}</span>)</> : ''}.
                  </p>
                </div>
              </label>

              {selectedProvider?.provider === 'cloudflare' && tempCreateDnsRecord && (
                <label
                  htmlFor="modal_dns_record_proxied"
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none ml-4',
                    tempDnsRecordProxied ? 'bg-orange-500/5 border-orange-500/30' : 'bg-muted/20 hover:bg-muted/40'
                  )}
                >
                  <Checkbox
                    id="modal_dns_record_proxied"
                    checked={tempDnsRecordProxied}
                    onCheckedChange={(checked) => setTempDnsRecordProxied(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1">
                    <span className="text-xs font-medium leading-none text-foreground flex items-center gap-1.5">
                      <span>Enable Cloudflare Proxy</span>
                      <span className="text-[10px] font-normal text-muted-foreground">(CDN &amp; DDoS Protection)</span>
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Routes web traffic through Cloudflare for caching, edge SSL, and DDoS mitigation.
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <DialogFooter className="border-t px-6 py-3.5 bg-muted/20 gap-2">
            <Button variant="outline" type="button" onClick={() => setDnsDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApplyDns} disabled={!tempZoneId}>
              Use Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
