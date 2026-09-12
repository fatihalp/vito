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
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  EyeIcon,
  HardDriveIcon,
  InfoIcon,
  LayersIcon,
  LoaderCircleIcon,
  PlusIcon,
  TrashIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

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

  const [collapsedIds, setCollapsedIds] = useState<Record<number, boolean>>({});
  const [showConnect, setShowConnect] = useState(page.props.resources.length === 0);

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
        setShowConnect(false);
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

  const toggleExpanded = (id: number) => {
    setCollapsedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getResourceTitle = (resource: SiteResource) => {
    if (resource.type_value === 'database') {
      const conn = resource.environment?.DB_CONNECTION;
      if (conn === 'pgsql' || conn === 'postgresql') return 'PostgreSQL Database';
      if (conn === 'mysql') return 'MySQL Database';
      if (conn === 'mariadb') return 'MariaDB Database';
      return 'Database';
    }
    if (resource.type_value === 'cache') {
      return 'Redis Cache';
    }
    if (resource.type_value === 'storage') {
      return resource.storage_provider?.name ?? 'Storage';
    }
    return resource.type;
  };

  const getResourceSubtitle = (resource: SiteResource) => {
    if (resource.server) {
      return `${resource.server.name} · ${resource.server.ip}`;
    }
    if (resource.storage_provider) {
      return `${resource.storage_provider.provider.toUpperCase()} · Object Storage`;
    }
    return 'Connected resource';
  };

  const copyEnv = (resource: SiteResource) => {
    if (!resource.environment || Object.keys(resource.environment).length === 0) {
      toast.error('No environment variables to copy');
      return;
    }
    const text = Object.entries(resource.environment)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${getResourceTitle(resource)} environment variables copied`))
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  const resourcesCount = page.props.resources?.length ?? page.props.site.counts?.resources;

  return (
    <ServerLayout>
      <Head title={`Resources - ${page.props.site.domain}`} />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title={`Resources${typeof resourcesCount === 'number' && resourcesCount > 0 ? ` (${resourcesCount})` : ''}`} />
          <div className="flex items-center gap-2">
            {availableTypes.length > 0 && (
              <Button
                variant={showConnect ? 'secondary' : 'default'}
                size="sm"
                onClick={() => setShowConnect((prev) => !prev)}
              >
                <PlusIcon className="mr-1 size-3.5" />
                {showConnect ? 'Close' : 'Connect resource'}
              </Button>
            )}
            {page.props.site.status !== 'installation_failed' && <SiteBanners site={page.props.site} compact />}
          </div>
        </HeaderContainer>

        {page.props.site.status === 'installation_failed' && <SiteBanners site={page.props.site} />}

        {showConnect && availableTypes.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Connect a resource</CardTitle>
              <CardDescription>Link a database, cache server, or storage provider to this site.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
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
                          <ExternalLinkIcon className="mr-1 size-3.5" />
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
            </CardContent>
          </Card>
        )}

        <div className="flex w-full flex-col gap-3">
          {page.props.resources.map((resource) => {
            const ResourceIcon = typeIcon(resource.type_value);
            const title = getResourceTitle(resource);
            const subtitle = getResourceSubtitle(resource);
            const isExpanded = !collapsedIds[resource.id];
            const hasEnv = resource.environment && Object.keys(resource.environment).length > 0;

            return (
              <Card key={resource.id} className="w-full min-w-0 transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-muted/60 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <ResourceIcon className="size-4.5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">{title}</span>
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                          {resource.type}
                        </Badge>
                        {resource.status !== 'ready' && (
                          <Badge variant={resource.status_color}>
                            {resource.status === 'connecting' && <LoaderCircleIcon className="mr-1 size-3 animate-spin" />}
                            {resource.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {hasEnv && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => copyEnv(resource)}
                        title="Copy environment variables to clipboard"
                      >
                        <CopyIcon className="size-3.5" />
                        <span>Copy .env</span>
                      </Button>
                    )}

                    {hasEnv && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => toggleExpanded(resource.id)}
                        title={isExpanded ? 'Hide credentials' : 'View credentials'}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUpIcon className="size-3.5" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon className="size-3.5" />
                            <span>Credentials</span>
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Disconnect ${resource.type}`}
                      title="Disconnect"
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
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {isExpanded && resource.environment && Object.keys(resource.environment).length > 0 && (
                  <div className="border-t border-border/50 bg-muted/10 p-4 pt-3">
                    <ResourceCredentialsView
                      environment={resource.environment}
                      type={resource.type_value}
                      title={null}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {page.props.resources.length === 0 && !showConnect && (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-8 text-sm">
              <p>No resources connected yet.</p>
              <Button size="sm" onClick={() => setShowConnect(true)}>
                <PlusIcon className="mr-1 size-3.5" /> Connect resource
              </Button>
            </CardContent>
          </Card>
        )}
      </Container>
    </ServerLayout>
  );
}
