import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CloudIcon, GlobeIcon, RefreshCwIcon, ServerIcon, UnlinkIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
            className="flex items-center gap-1 text-xs text-primary hover:underline font-normal"
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
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline ml-2"
          >
            <UnlinkIcon className="size-3" />
            Unlink
          </button>
        </div>
      )}

      <InputError message={error} />

      {/* DNS Provider Modal Dialog */}
      <Dialog open={dnsDialogOpen} onOpenChange={setDnsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Select from DNS Provider</DialogTitle>
            <DialogDescription>
              Select a domain managed by your DNS provider to automatically configure DNS records for this site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {connectedProviders.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="dns_provider_modal_id">DNS Provider</Label>
                <div className="flex items-center gap-2">
                  <Select value={tempProviderId} onValueChange={handleProviderSelect}>
                    <SelectTrigger id="dns_provider_modal_id">
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
                    <Button variant="outline" size="icon" type="button" aria-label="Connect DNS Provider">
                      <CloudIcon className="h-4 w-4" />
                    </Button>
                  </ConnectDNSProvider>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="provider_zone_id">Domain / Zone</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={tempZoneId}
                    onValueChange={setTempZoneId}
                    disabled={!tempProviderId || loadingDomains}
                  >
                    <SelectTrigger id="provider_zone_id">
                      <SelectValue placeholder={loadingDomains ? 'Loading...' : 'Select a domain'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableDomains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.id}>
                            <div className="flex items-center gap-2">
                              <GlobeIcon className="h-4 w-4" />
                              <span>{domain.name}</span>
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
                    disabled={loadingDomains || !tempProviderId}
                    onClick={() => fetchDomainsForProvider(tempProviderId, true)}
                  >
                    <RefreshCwIcon className={`h-4 w-4 ${loadingDomains ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="subdomain_modal">Subdomain</Label>
                <Input
                  type="text"
                  id="subdomain_modal"
                  value={tempSubdomain}
                  onChange={(e) => setTempSubdomain(e.target.value)}
                  placeholder="e.g. app, api, or leave empty"
                />
              </div>
            </div>

            {computedDialogDomain && (
              <div className="bg-muted/50 space-y-1.5 rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Site domain:</span>
                  <span className="text-foreground font-mono font-semibold">{computedDialogDomain}</span>
                </div>
                {tempCreateDnsRecord && serverIp && (
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <ServerIcon className="h-3 w-3" />
                      <span>DNS A Record:</span>
                    </span>
                    <span className="text-foreground font-mono font-medium">
                      {computedDialogDomain} &rarr; {serverIp}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="modal_create_dns_record"
                  checked={tempCreateDnsRecord}
                  onCheckedChange={(checked) => setTempCreateDnsRecord(Boolean(checked))}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor="modal_create_dns_record" className="cursor-pointer font-medium text-xs">
                    Automatically create an A record
                  </Label>
                  <p className="text-muted-foreground text-[11px]">
                    Points <span className="font-mono">{computedDialogDomain || 'domain'}</span> at server IP
                    {serverIp ? <> (<span className="font-mono">{serverIp}</span>)</> : null}.
                  </p>
                </div>
              </div>

              {selectedProvider?.provider === 'cloudflare' && tempCreateDnsRecord && (
                <div className="flex items-start space-x-3 pl-6">
                  <Checkbox
                    id="modal_dns_record_proxied"
                    checked={tempDnsRecordProxied}
                    onCheckedChange={(checked) => setTempDnsRecordProxied(Boolean(checked))}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label htmlFor="modal_dns_record_proxied" className="cursor-pointer font-medium text-xs">
                      Enable Cloudflare Proxy (CDN & DDoS Protection)
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
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
