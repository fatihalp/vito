import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import ResourceCredentialsView from '@/components/resource-credentials-view';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialog } from '@/hooks/use-dialog';
import ServerLayout from '@/layouts/server/layout';
import { useConfigs } from '@/stores/bootstrap-store';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import type { SiteResource, SiteResourceServerOption } from '@/types/site-resource';
import type { StorageProvider } from '@/types/storage-provider';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { DatabaseIcon, ExternalLinkIcon, EyeIcon, HardDriveIcon, InfoIcon, LayersIcon, LoaderCircleIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

type ResourceType = SiteResource['type_value'];

const resourceTypes: Array<{ value: ResourceType; label: string }> = [
  { value: 'database', label: 'Database server' },
  { value: 'cache', label: 'Cache (Redis) server' },
  { value: 'storage', label: 'Storage Provider' },
];

const defaultServiceName: Partial<Record<ResourceType, string>> = {
  database: 'postgresql',
  cache: 'redis',
};

const typeIcon = (type: ResourceType) => {
  if (type === 'database') return DatabaseIcon;
  if (type === 'cache') return LayersIcon;
  return HardDriveIcon;
};

export default function SiteResources() {
  const page = usePage<{
    server: Server;
    site: Site;
    resources: SiteResource[];
    servers: SiteResourceServerOption[];
    storageProviders: StorageProvider[];
  }>();
  const dialog = useDialog();
  const configs = useConfigs();
  const installForm = useForm<{ name: string; version: string }>({ name: '', version: '' });
  const connectedTypes = new Set(page.props.resources.map((resource) => resource.type_value));
  const availableTypes = resourceTypes.filter((type) => !connectedTypes.has(type.value));
  const form = useForm<{ type: ResourceType | ''; server_id: string; storage_provider_id: string; confirm_overwrite: boolean }>({
    type: '',
    server_id: '',
    storage_provider_id: '',
    confirm_overwrite: false,
  });
  const selectedDefinition = resourceTypes.find((type) => type.value === form.data.type);
  const hasServiceForType = (server: (typeof page.props.servers)[number]) =>
    form.data.type === 'database' ? server.has_database : form.data.type === 'cache' ? server.has_cache : false;
  const currentServerOption = page.props.servers.find((server) => server.id === page.props.server.id);
  const currentServerHasService = !!currentServerOption && hasServiceForType(currentServerOption);
  const currentServerStatus =
    form.data.type === 'database'
      ? currentServerOption?.database_status
      : form.data.type === 'cache'
        ? currentServerOption?.cache_status
        : null;
  const currentServerInstalling = currentServerStatus != null && currentServerStatus !== 'ready';
  const matchingServers =
    form.data.type === 'storage' || form.data.type === ''
      ? []
      : page.props.servers.filter((server) => server.role_value === form.data.type || server.id === page.props.server.id);
  const targetSelected = form.data.type === 'storage'
    ? form.data.storage_provider_id !== ''
    : form.data.server_id !== '';
  const targetsCurrentServerWithoutService =
    form.data.type !== 'storage' && form.data.type !== '' && form.data.server_id === String(page.props.server.id) && !currentServerHasService;

  const [pendingConnect, setPendingConnect] = useState(false);

  useEffect(() => {
    if (!page.props.resources.some((resource) => resource.status === 'connecting')) {
      return;
    }

    const interval = window.setInterval(() => {
      router.reload({ only: ['resources'] });
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [page.props.resources]);

  const connect = (overwrite = false) => {
    const payload = overwrite ? { ...form.data, confirm_overwrite: true } : form.data;
    router.post(route('site-resources.store', { server: page.props.server.id, site: page.props.site.id }), payload, {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
      },
      onError: (errors) => {
        form.setError(errors as Record<string, string>);
        const serverError = typeof errors.server_id === 'string' ? errors.server_id : '';
        const storageError = typeof errors.storage_provider_id === 'string' ? errors.storage_provider_id : '';
        const overwriteError = [serverError, storageError].find((msg) =>
          msg.includes('Existing database configuration found') ||
          msg.includes('Existing Redis/Cache configuration found') ||
          msg.includes('Existing storage configuration found')
        );

        if (!overwrite && overwriteError) {
          form.clearErrors('server_id');
          form.clearErrors('storage_provider_id');
          dialog.confirm.open({
            title: 'Existing configuration found',
            description: overwriteError,
            variant: 'destructive',
            confirmLabel: 'Overwrite settings',
            method: 'post',
            url: route('site-resources.store', { server: page.props.server.id, site: page.props.site.id }),
            data: { ...form.data, confirm_overwrite: true },
          });
        }
      },
    });
  };

  useEffect(() => {
    if (!pendingConnect) {
      return;
    }

    if (currentServerHasService) {
      setPendingConnect(false);
      connect();
      return;
    }

    const interval = window.setInterval(() => {
      router.reload({ only: ['servers'] });
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [pendingConnect, currentServerHasService]);

  const submit = (event: FormEvent) => {
    event.preventDefault();

    if (targetsCurrentServerWithoutService) {
      installDefaultService();
      setPendingConnect(true);
      return;
    }

    connect();
  };

  const installDefaultService = () => {
    if (form.data.type !== 'database' && form.data.type !== 'cache') {
      return;
    }

    if (currentServerInstalling) {
      return;
    }

    const name = defaultServiceName[form.data.type];
    if (!name || !configs) {
      return;
    }

    const versions = configs.service.services[name]?.versions ?? [];
    installForm.transform(() => ({ name, version: versions[0] ?? 'latest' }));
    installForm.post(route('services.store', { server: page.props.server.id }), { preserveScroll: true });
  };

  const resourcesCount = page.props.resources?.length ?? page.props.site.counts?.resources;

  return (
    <ServerLayout>
      <Head title={`Resources - ${page.props.site.domain}`} />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title={`Resources${typeof resourcesCount === 'number' && resourcesCount > 0 ? ` (${resourcesCount})` : ''}`} />
          <SiteBanners site={page.props.site} compact />
        </HeaderContainer>

        {page.props.site.status === 'installation_failed' && <SiteBanners site={page.props.site} />}

        <Card>
          <CardHeader>
            <CardTitle>Connect a resource</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {availableTypes.length > 0 ? (
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="resource-type">Resource type</Label>
                  <Select
                    value={form.data.type}
                    onValueChange={(value: ResourceType) => {
                      form.setData({ type: value, server_id: '', storage_provider_id: '' });
                    }}
                  >
                    <SelectTrigger id="resource-type">
                      <SelectValue placeholder="Select a resource" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <InputError message={form.errors.type} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="resource-target">Target</Label>
                  {form.data.type === 'storage' ? (
                    <Select
                      value={form.data.storage_provider_id}
                      onValueChange={(value) => form.setData('storage_provider_id', value)}
                      disabled={page.props.storageProviders.length === 0}
                    >
                      <SelectTrigger id="resource-target">
                        <SelectValue placeholder={page.props.storageProviders.length === 0 ? 'No storage provider configured' : 'Select a storage provider'} />
                      </SelectTrigger>
                      <SelectContent>
                        {page.props.storageProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id.toString()}>
                            {provider.name} ({provider.provider.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={form.data.server_id}
                      onValueChange={(value) => form.setData('server_id', value)}
                      disabled={form.data.type === ''}
                    >
                      <SelectTrigger id="resource-target">
                        <SelectValue placeholder="Select a server" />
                      </SelectTrigger>
                      <SelectContent>
                        {matchingServers.map((server) => {
                          const isCurrent = server.id === page.props.server.id;
                          const installed = hasServiceForType(server);
                          const label = isCurrent
                            ? installed
                              ? `This server (${server.name})`
                              : `This server (${server.name}) — install ${defaultServiceName[form.data.type as ResourceType] ?? ''}`
                            : server.name;
                          return (
                            <SelectItem key={server.id} value={server.id.toString()}>
                              {label} · {server.ip}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <InputError message={form.errors.server_id || form.errors.storage_provider_id} />
                </div>

                <Button type="submit" disabled={!form.data.type || !targetSelected || form.processing || pendingConnect}>
                  {form.processing || pendingConnect ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
                  {targetsCurrentServerWithoutService ? `Install & Connect` : 'Connect'}
                </Button>

                {form.data.type === 'storage' && page.props.storageProviders.length === 0 && (
                  <Alert className="md:col-span-3">
                    <InfoIcon className="size-4" />
                    <AlertDescription className="flex items-center justify-between gap-4">
                      <span>No storage providers found. Connect a storage provider in Settings first.</span>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={route('storage-providers')}>
                          <ExternalLinkIcon className="size-3.5 mr-1" />
                          Storage Providers
                        </Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {form.data.type && form.data.type !== 'storage' && !currentServerHasService && (
                  <Alert className="md:col-span-3">
                    <InfoIcon />
                    <AlertDescription className="flex items-center justify-between gap-4">
                      <span>
                        {currentServerInstalling
                          ? `Installing ${defaultServiceName[form.data.type] ?? ''} on this server (${currentServerStatus})… it will connect automatically once ready.`
                          : matchingServers.length > 1
                            ? `${selectedDefinition?.label} isn't installed on this server yet — pick "This server" above to install ${defaultServiceName[form.data.type] ?? ''} and connect automatically, or pick from the list.`
                            : `No ready ${selectedDefinition?.label.toLowerCase()} available — pick "This server" above to install ${defaultServiceName[form.data.type] ?? ''} and connect automatically.`}
                      </span>
                      {!currentServerInstalling && (
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={installForm.processing}
                          onClick={() => form.setData('server_id', String(page.props.server.id))}
                        >
                          This server
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">All supported resource types are connected.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex w-full flex-col gap-6">
          {page.props.resources.map((resource) => {
            const ResourceIcon = typeIcon(resource.type_value);
            const target = resource.server?.name ?? resource.storage_provider?.name ?? 'Unavailable resource';
            const targetDetail = resource.server
              ? `${resource.server.role} · ${resource.server.ip}`
              : resource.storage_provider
                ? `${resource.storage_provider.provider.toUpperCase()} · ${resource.storage_provider.name}`
                : 'The connected resource is no longer available';

            return (
              <Card key={resource.id} className="w-full min-w-0">
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-md">
                      <ResourceIcon className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="truncate">{target}</CardTitle>
                        <Badge variant={resource.type_color}>{resource.type}</Badge>
                        <Badge variant={resource.status_color}>{resource.status}</Badge>
                      </div>
                      <CardDescription className="truncate">{targetDetail}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View credentials for ${target}`}
                      onClick={() =>
                        dialog.siteResourceReveal.open({
                          serverId: page.props.server.id,
                          siteId: page.props.site.id,
                          resource,
                        })
                      }
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Disconnect ${resource.type}`}
                      onClick={() =>
                        dialog.confirm.open({
                          title: `Disconnect ${resource.type}?`,
                          description:
                            resource.type_value === 'database'
                              ? 'Vito-managed environment variables will be restored, and the database plus generated user will be permanently deleted.'
                              : 'Vito-managed environment variables will be removed and their previous values restored.',
                          confirmLabel: 'Disconnect',
                          variant: 'destructive',
                          method: 'delete',
                          url: route('site-resources.destroy', {
                            server: page.props.server.id,
                            site: page.props.site.id,
                            resource: resource.id,
                          }),
                        })
                      }
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0">
                  {resource.environment && Object.keys(resource.environment).length > 0 ? (
                    <ResourceCredentialsView
                      environment={resource.environment}
                      type={resource.type_value}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {resource.environment_keys.map((key) => (
                        <Badge key={key} variant="outline" className="font-mono">{key}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {page.props.resources.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground flex min-h-32 items-center justify-center p-6 text-sm">No resources connected.</CardContent>
          </Card>
        )}
      </Container>
    </ServerLayout>
  );
}
