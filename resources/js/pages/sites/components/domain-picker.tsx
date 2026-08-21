import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CloudIcon, GlobeIcon, RefreshCwIcon, ServerIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
}: {
  value: DomainPickerValue;
  onChange: (value: DomainPickerValue) => void;
  serverIp?: string;
  error?: string;
}) {
  const [mode, setMode] = useState<'provider' | 'manual'>('provider');
  const [dnsProviders, setDnsProviders] = useState<DNSProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [availableDomains, setAvailableDomains] = useState<ProviderDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [manualDomain, setManualDomain] = useState('');

  const connectedProviders = useMemo(() => dnsProviders.filter((p) => p.connected), [dnsProviders]);
  const selectedZone = useMemo(
    () => availableDomains.find((d) => d.id === value.provider_domain_id) || null,
    [availableDomains, value.provider_domain_id],
  );
  const selectedProvider = useMemo(
    () => dnsProviders.find((p) => String(p.id) === String(value.dns_provider_id)) || null,
    [dnsProviders, value.dns_provider_id],
  );

  const computedDomain = useMemo(() => {
    if (mode === 'manual') {
      return manualDomain.trim().toLowerCase();
    }
    if (!selectedZone) {
      return '';
    }
    const clean = subdomain.trim().toLowerCase().replace(/\.+$/, '').replace(/^\.+/, '');
    if (!clean || clean === '@') {
      return selectedZone.name.toLowerCase();
    }
    return `${clean}.${selectedZone.name.toLowerCase()}`;
  }, [mode, manualDomain, selectedZone, subdomain]);

  useEffect(() => {
    if (computedDomain !== value.domain) {
      onChange({ ...value, domain: computedDomain });
    }
  }, [computedDomain]);

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

      if (domains.length > 0 && !value.provider_domain_id) {
        onChange({ ...value, provider_domain_id: domains[0].id });
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
      if (connected.length > 0) {
        const firstProviderId = String(connected[0].id);
        onChange({ ...value, dns_provider_id: firstProviderId });
        fetchDomainsForProvider(firstProviderId);
      } else {
        setMode('manual');
      }
    } catch {
      setMode('manual');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    onChange({ ...value, dns_provider_id: providerId, provider_domain_id: '' });
    fetchDomainsForProvider(providerId);
  };

  const handleZoneChange = (zoneId: string) => {
    onChange({ ...value, provider_domain_id: zoneId });
  };

  const handleModeChange = (newMode: 'provider' | 'manual') => {
    setMode(newMode);
    if (newMode === 'manual') {
      onChange({ ...value, dns_provider_id: '', provider_domain_id: '', create_dns_record: false });
    } else {
      const providerId = value.dns_provider_id || (connectedProviders[0] ? String(connectedProviders[0].id) : '');
      onChange({ ...value, dns_provider_id: providerId, create_dns_record: true });
      if (providerId && availableDomains.length === 0) {
        fetchDomainsForProvider(providerId);
      }
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  return (
    <div className="space-y-3">
      {connectedProviders.length > 0 && (
        <Tabs value={mode} onValueChange={(val) => handleModeChange(val as 'provider' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="provider" className="flex items-center gap-1.5">
              <CloudIcon className="h-4 w-4" />
              <span>From DNS Provider</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5">
              <GlobeIcon className="h-4 w-4" />
              <span>Custom Domain</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {mode === 'provider' && connectedProviders.length > 0 ? (
        <>
          {connectedProviders.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="dns_provider_id">DNS Provider</Label>
              <div className="flex items-center gap-2">
                <Select value={value.dns_provider_id} onValueChange={handleProviderChange}>
                  <SelectTrigger id="dns_provider_id">
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
            <div className="space-y-1">
              <Label htmlFor="provider_domain_id">Domain</Label>
              <div className="flex items-center gap-2">
                <Select value={value.provider_domain_id} onValueChange={handleZoneChange} disabled={!value.dns_provider_id || loadingDomains}>
                  <SelectTrigger id="provider_domain_id">
                    <SelectValue placeholder={loadingDomains ? 'Loading domains...' : 'Select a domain'} />
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
                  disabled={loadingDomains || !value.dns_provider_id}
                  onClick={() => fetchDomainsForProvider(value.dns_provider_id, true)}
                >
                  <RefreshCwIcon className={`h-4 w-4 ${loadingDomains ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="subdomain">Subdomain</Label>
              <Input
                type="text"
                id="subdomain"
                name="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="e.g. app, api, or leave empty for root"
              />
            </div>
          </div>

          {computedDomain && (
            <div className="bg-muted/40 space-y-1.5 rounded-md border p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Site domain:</span>
                <span className="text-foreground font-mono font-semibold">{computedDomain}</span>
              </div>
              {value.create_dns_record && serverIp && (
                <div className="text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ServerIcon className="h-3 w-3" />
                    <span>DNS A Record:</span>
                  </span>
                  <span className="text-foreground font-mono font-medium">
                    {computedDomain} &rarr; {serverIp}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="create_dns_record"
                checked={value.create_dns_record}
                onCheckedChange={(checked) => onChange({ ...value, create_dns_record: Boolean(checked) })}
              />
              <div className="grid gap-0.5 leading-none">
                <Label htmlFor="create_dns_record" className="cursor-pointer font-medium">
                  Automatically create an A record
                </Label>
                <p className="text-muted-foreground text-xs">
                  Points <span className="font-mono font-medium">{computedDomain || 'this domain'}</span> at the server&apos;s IP
                  {serverIp ? <> (<span className="font-mono font-medium">{serverIp}</span>)</> : null}.
                </p>
              </div>
            </div>

            {selectedProvider?.provider === 'cloudflare' && value.create_dns_record && (
              <div className="flex items-start space-x-3 pl-6">
                <Checkbox
                  id="dns_record_proxied"
                  checked={value.dns_record_proxied}
                  onCheckedChange={(checked) => onChange({ ...value, dns_record_proxied: Boolean(checked) })}
                />
                <div className="grid gap-0.5 leading-none">
                  <Label htmlFor="dns_record_proxied" className="cursor-pointer font-medium">
                    Enable Cloudflare Proxy (CDN & DDoS Protection)
                  </Label>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <Label htmlFor="domain">Domain</Label>
          <Input
            type="text"
            id="domain"
            name="domain"
            value={manualDomain}
            onChange={(e) => setManualDomain(e.target.value)}
            placeholder="example.com or app.example.com"
          />
        </div>
      )}

      <InputError message={error} />
    </div>
  );
}
