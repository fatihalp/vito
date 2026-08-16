import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { CloudIcon, GlobeIcon, LoaderCircleIcon, RefreshCwIcon, ServerIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Site } from '@/types/site';
import { Server } from '@/types/server';
import { DNSProvider } from '@/types/dns-provider';
import FormSuccessful from '@/components/form-successful';
import { useSslMatching } from '@/pages/hosted-domains/hooks/use-ssl-matching';
import ConnectDNSProvider from '@/pages/dns-providers/components/connect-dns-provider';
import axios from 'axios';

type CreateForm = {
  domain: string;
  type: string;
  ssl_method: string;
  ssl_id: string;
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

const SSL_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Disabled' },
  { value: 'letsencrypt', label: "Generate Let's Encrypt Certificate" },
  { value: 'custom', label: 'Custom Certificate' },
];

export default function CreateHostedDomain({ open, onOpenChange, site }: { open: boolean; onOpenChange: (open: boolean) => void; site: Site }) {
  const page = usePage<{ server?: Server }>();
  const serverIp = site.server?.ip || page.props.server?.ip || '';

  const { ssl_enabled } = site;
  const allowedSslMethods = site.webserver_allowed_ssl_methods;
  const sslMethodOptions = allowedSslMethods ? SSL_METHOD_OPTIONS.filter((option) => allowedSslMethods.includes(option.value)) : SSL_METHOD_OPTIONS;
  const defaultSslMethod = !ssl_enabled && sslMethodOptions.some((option) => option.value === 'none') ? 'none' : site.webserver_default_ssl_method;

  const [mode, setMode] = useState<'provider' | 'manual'>('provider');
  const [dnsProviders, setDnsProviders] = useState<DNSProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [availableDomains, setAvailableDomains] = useState<ProviderDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [subdomain, setSubdomain] = useState<string>('');
  const [manualDomain, setManualDomain] = useState<string>('');

  const form = useForm<CreateForm>({
    domain: '',
    type: 'alias',
    ssl_method: defaultSslMethod,
    ssl_id: '',
    dns_provider_id: '',
    provider_domain_id: '',
    create_dns_record: true,
    dns_record_proxied: false,
  });

  const connectedProviders = useMemo(() => dnsProviders.filter((p) => p.connected), [dnsProviders]);

  const selectedZone = useMemo(
    () => availableDomains.find((d) => d.id === selectedZoneId) || null,
    [availableDomains, selectedZoneId],
  );

  const selectedProvider = useMemo(
    () => dnsProviders.find((p) => String(p.id) === String(form.data.dns_provider_id)) || null,
    [dnsProviders, form.data.dns_provider_id],
  );

  const computedDomain = useMemo(() => {
    if (mode === 'manual') {
      return manualDomain.trim().toLowerCase();
    }
    if (!selectedZone) {
      return '';
    }
    const cleanSubdomain = subdomain.trim().toLowerCase().replace(/\.+$/, '').replace(/^\.+/, '');
    if (!cleanSubdomain || cleanSubdomain === '@') {
      return selectedZone.name.toLowerCase();
    }
    return `${cleanSubdomain}.${selectedZone.name.toLowerCase()}`;
  }, [mode, manualDomain, selectedZone, subdomain]);

  // Keep form.data.domain in sync with computedDomain
  useEffect(() => {
    form.setData('domain', computedDomain);
  }, [computedDomain]);

  const { matchingSsls, loadingSsls, sslStale, handleSslMethodChange } = useSslMatching({
    serverId: site.server_id,
    siteId: site.id,
    domain: form.data.domain,
    sslId: form.data.ssl_id,
    applySslSettings: ({ ssl_method, ssl_id }) => {
      form.setData('ssl_method', ssl_method);
      form.setData('ssl_id', ssl_id);
    },
    open,
  });

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

      if (domains.length > 0 && !selectedZoneId) {
        setSelectedZoneId(domains[0].id);
        form.setData('provider_domain_id', domains[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch provider domains:', error);
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
        form.setData('dns_provider_id', firstProviderId);
        fetchDomainsForProvider(firstProviderId);
      } else {
        setMode('manual');
      }
    } catch (error) {
      console.error('Failed to fetch DNS providers:', error);
      setMode('manual');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    form.setData('dns_provider_id', providerId);
    setSelectedZoneId('');
    form.setData('provider_domain_id', '');
    fetchDomainsForProvider(providerId);
  };

  const handleZoneChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    form.setData('provider_domain_id', zoneId);
  };

  const handleModeChange = (newMode: 'provider' | 'manual') => {
    setMode(newMode);
    if (newMode === 'manual') {
      form.setData({
        ...form.data,
        dns_provider_id: '',
        provider_domain_id: '',
        create_dns_record: false,
      });
    } else {
      const providerId = form.data.dns_provider_id || (connectedProviders[0] ? String(connectedProviders[0].id) : '');
      form.setData({
        ...form.data,
        dns_provider_id: providerId,
        provider_domain_id: selectedZoneId,
        create_dns_record: true,
      });
      if (providerId && availableDomains.length === 0) {
        fetchDomainsForProvider(providerId);
      }
    }
  };

  useEffect(() => {
    if (open) {
      setSubdomain('');
      setManualDomain('');
      setSelectedZoneId('');
      fetchProviders();
    }
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(
      route('hosted-domains.store', {
        server: site.server_id,
        site: site.id,
      }),
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
          <DialogDescription className="sr-only">Add a domain to this site</DialogDescription>
        </DialogHeader>

        <Form className="p-4" id="create-hosted-domain-form" onSubmit={submit}>
          <FormFields>
            {connectedProviders.length > 0 ? (
              <div className="mb-2">
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
              </div>
            ) : null}

            {mode === 'provider' && connectedProviders.length > 0 ? (
              <>
                <FormField>
                  <Label htmlFor="dns_provider_id">DNS Provider</Label>
                  <div className="flex items-center gap-2">
                    <Select value={form.data.dns_provider_id} onValueChange={handleProviderChange}>
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
                  <InputError message={form.errors.dns_provider_id} />
                </FormField>

                <FormField>
                  <Label htmlFor="provider_domain_id">Cloudflare Zone (Root Domain)</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedZoneId}
                      onValueChange={handleZoneChange}
                      disabled={!form.data.dns_provider_id || loadingDomains}
                    >
                      <SelectTrigger id="provider_domain_id">
                        <SelectValue placeholder={loadingDomains ? 'Loading domains...' : 'Select a domain zone'} />
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
                      disabled={loadingDomains || !form.data.dns_provider_id}
                      onClick={() => fetchDomainsForProvider(form.data.dns_provider_id, true)}
                    >
                      <RefreshCwIcon className={`h-4 w-4 ${loadingDomains ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <InputError message={form.errors.provider_domain_id} />
                </FormField>

                <FormField>
                  <Label htmlFor="subdomain">Subdomain (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      id="subdomain"
                      name="subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      placeholder="e.g. app, api, or leave empty for root (@)"
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Leave blank or type <code className="rounded bg-muted px-1 py-0.5">@</code> to point the root domain itself.
                  </p>
                </FormField>

                {computedDomain && (
                  <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Domain to add:</span>
                      <span className="font-semibold text-foreground font-mono">{computedDomain}</span>
                    </div>
                    {form.data.create_dns_record && serverIp && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ServerIcon className="h-3 w-3" />
                          <span>DNS A Record:</span>
                        </span>
                        <span className="font-mono text-foreground font-medium">
                          {computedDomain} &rarr; {serverIp}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <FormField>
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="create_dns_record"
                        checked={form.data.create_dns_record}
                        onCheckedChange={(checked) => form.setData('create_dns_record', Boolean(checked))}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label htmlFor="create_dns_record" className="cursor-pointer font-medium">
                          Automatically create A record on Cloudflare
                        </Label>
                        <p className="text-muted-foreground text-xs">
                          Creates an A record pointing <span className="font-mono font-medium">{computedDomain || 'this domain'}</span> to server IP{' '}
                          <span className="font-mono font-medium">{serverIp || 'N/A'}</span>.
                        </p>
                      </div>
                    </div>

                    {selectedProvider?.provider === 'cloudflare' && form.data.create_dns_record && (
                      <div className="flex items-start space-x-3 pl-6">
                        <Checkbox
                          id="dns_record_proxied"
                          checked={form.data.dns_record_proxied}
                          onCheckedChange={(checked) => form.setData('dns_record_proxied', Boolean(checked))}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <Label htmlFor="dns_record_proxied" className="cursor-pointer font-medium">
                            Enable Cloudflare Proxy (CDN & DDoS Protection)
                          </Label>
                          <p className="text-muted-foreground text-xs">
                            Turn on orange cloud proxy on Cloudflare for this record.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <InputError message={form.errors.create_dns_record} />
                </FormField>
              </>
            ) : (
              <FormField>
                <Label htmlFor="domain">Domain</Label>
                <Input
                  type="text"
                  id="domain"
                  name="domain"
                  value={manualDomain}
                  onChange={(e) => setManualDomain(e.target.value)}
                  placeholder="example.com or app.example.com"
                />
                <InputError message={form.errors.domain} />
              </FormField>
            )}

            <FormField>
              <Label htmlFor="type">Type</Label>
              <Select onValueChange={(value) => form.setData('type', value)} value={form.data.type}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alias">Alias</SelectItem>
                  <SelectItem value="redirect">Redirect</SelectItem>
                </SelectContent>
              </Select>
              <InputError message={form.errors.type} />
            </FormField>

            <FormField>
              <Label htmlFor="ssl-method">SSL</Label>
              <Select onValueChange={handleSslMethodChange} value={form.data.ssl_method}>
                <SelectTrigger id="ssl-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sslMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.ssl_method} />
            </FormField>

            {form.data.ssl_method === 'custom' && (
              <FormField>
                <Label htmlFor="ssl_id">SSL Certificate</Label>
                <Select onValueChange={(value) => form.setData('ssl_id', value)} value={form.data.ssl_id}>
                  <SelectTrigger id="ssl_id">
                    <SelectValue placeholder={loadingSsls ? 'Loading...' : 'Select a certificate'} />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingSsls.map((ssl) => (
                      <SelectItem key={ssl.id} value={String(ssl.id)}>
                        {ssl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  Only server-level SSL certificates that match the domain you entered will appear here. Add certificates via the server SSL settings.
                </p>
                <InputError message={form.errors.ssl_id} />
              </FormField>
            )}
          </FormFields>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={submit}
            disabled={form.processing || loadingSsls || sslStale || !form.data.domain}
          >
            {(form.processing || loadingSsls || sslStale) && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            Add Domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

