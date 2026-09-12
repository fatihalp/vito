import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import ResourceCredentialsView from '@/components/resource-credentials-view';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialog } from '@/hooks/use-dialog';
import ServerLayout from '@/layouts/server/layout';
import { useConfigs } from '@/stores/bootstrap-store';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import type { SiteResource, SiteResourceServerOption } from '@/types/site-resource';
import type { StorageProvider } from '@/types/storage-provider';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  HardDriveIcon,
  LayersIcon,
  LoaderCircleIcon,
  PlusIcon,
  UnlinkIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type PendingConnect = {
  type: 'database' | 'cache';
  serverId: string;
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

  const [collapsedIds, setCollapsedIds] = useState<Record<number, boolean>>({});
  const [selectedDbServerId, setSelectedDbServerId] = useState(String(page.props.server.id));
  const [selectedCacheServerId, setSelectedCacheServerId] = useState(String(page.props.server.id));
  const [selectedStorageProviderId, setSelectedStorageProviderId] = useState(
    page.props.storageProviders[0]?.id?.toString() ?? '',
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pendingConnect, setPendingConnect] = useState<PendingConnect | null>(null);

  const dbResource = page.props.resources.find((r) => r.type_value === 'database');
  const cacheResource = page.props.resources.find((r) => r.type_value === 'cache');
  const storageResource = page.props.resources.find((r) => r.type_value === 'storage');

  const dbServers = page.props.servers.filter(
    (s) => s.role_value === 'database' || s.id === page.props.server.id,
  );
  const cacheServers = page.props.servers.filter(
    (s) => s.role_value === 'cache' || s.id === page.props.server.id,
  );

  const selectedDbServer =
    page.props.servers.find((s) => s.id.toString() === selectedDbServerId) ??
    page.props.servers.find((s) => s.id === page.props.server.id);
  const selectedCacheServer =
    page.props.servers.find((s) => s.id.toString() === selectedCacheServerId) ??
    page.props.servers.find((s) => s.id === page.props.server.id);

  const isDbReady = !!selectedDbServer?.has_database;
  const isDbInstalling =
    (selectedDbServer?.database_status != null && selectedDbServer.database_status !== 'ready') ||
    (pendingConnect?.type === 'database' && pendingConnect.serverId === selectedDbServerId);

  const isCacheReady = !!selectedCacheServer?.has_cache;
  const isCacheInstalling =
    (selectedCacheServer?.cache_status != null && selectedCacheServer.cache_status !== 'ready') ||
    (pendingConnect?.type === 'cache' && pendingConnect.serverId === selectedCacheServerId);

  useEffect(() => {
    if (!page.props.resources.some((resource) => resource.status === 'connecting')) {
      return;
    }

    const interval = window.setInterval(() => {
      router.reload({ only: ['resources'] });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [page.props.resources]);

  const connectResource = ({
    type,
    serverId,
    storageProviderId,
    confirmOverwrite = false,
  }: {
    type: 'database' | 'cache' | 'storage';
    serverId?: string;
    storageProviderId?: string;
    confirmOverwrite?: boolean;
  }) => {
    setIsConnecting(true);
    const data: Record<string, string | boolean | undefined> = {
      type,
      confirm_overwrite: confirmOverwrite,
    };
    if (type === 'storage') {
      data.storage_provider_id = storageProviderId;
    } else {
      data.server_id = serverId;
    }

    router.post(
      route('site-resources.store', { server: page.props.server.id, site: page.props.site.id }),
      data,
      {
        preserveScroll: true,
        onFinish: () => setIsConnecting(false),
        onError: (errors) => {
          const serverError = typeof errors.server_id === 'string' ? errors.server_id : '';
          const storageError = typeof errors.storage_provider_id === 'string' ? errors.storage_provider_id : '';
          const typeError = typeof errors.type === 'string' ? errors.type : '';
          const overwriteError = [serverError, storageError].find(
            (msg) =>
              msg.includes('Existing database configuration found') ||
              msg.includes('Existing Redis/Cache configuration found') ||
              msg.includes('Existing storage configuration found'),
          );

          if (!confirmOverwrite && overwriteError) {
            dialog.confirm.open({
              title: 'Existing configuration found',
              description: overwriteError,
              variant: 'destructive',
              confirmLabel: 'Overwrite settings',
              method: 'post',
              url: route('site-resources.store', { server: page.props.server.id, site: page.props.site.id }),
              data: { ...data, confirm_overwrite: true },
            });
          } else {
            toast.error(serverError || storageError || typeError || 'Failed to connect resource');
          }
        },
      },
    );
  };

  const installAndConnect = (type: 'database' | 'cache', targetServerId: string) => {
    const serviceName = type === 'database' ? 'postgresql' : 'redis';
    const versions = configs?.service?.services?.[serviceName]?.versions ?? [];
    const version = versions[0] ?? 'latest';

    setIsInstalling(true);
    router.post(
      route('services.store', { server: targetServerId }),
      { name: serviceName, version },
      {
        preserveScroll: true,
        onSuccess: () => {
          setPendingConnect({ type, serverId: targetServerId });
        },
        onFinish: () => setIsInstalling(false),
        onError: () => {
          toast.error(`Failed to start ${serviceName} installation`);
        },
      },
    );
  };

  useEffect(() => {
    if (!pendingConnect) {
      return;
    }

    const targetServer = page.props.servers.find(
      (s) => s.id.toString() === pendingConnect.serverId,
    );
    const isReady =
      pendingConnect.type === 'database'
        ? targetServer?.has_database
        : targetServer?.has_cache;

    if (isReady) {
      const { type, serverId } = pendingConnect;
      setPendingConnect(null);
      connectResource({ type, serverId });
      return;
    }

    const interval = window.setInterval(() => {
      router.reload({ only: ['servers'] });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [pendingConnect, page.props.servers]);

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
      return resource.storage_provider?.name ?? 'Object Storage';
    }
    return resource.type;
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

  const disconnectResource = (resource: SiteResource) => {
    dialog.confirm.open({
      title: `Disconnect ${resource.type}?`,
      description:
        resource.type_value === 'database'
          ? 'This site will be disconnected from the database and its DB_* environment variables will be removed. Your database and data will NOT be deleted and remain completely intact on your server.'
          : resource.type_value === 'cache'
            ? 'This site will be disconnected from Redis and its cache environment variables will be restored. Your Redis service remains running on the server.'
            : 'This site will be disconnected from the storage provider and its filesystem environment variables will be restored.',
      confirmLabel: 'Disconnect',
      variant: 'default',
      method: 'delete',
      url: route('site-resources.destroy', {
        server: page.props.server.id,
        site: page.props.site.id,
        resource: resource.id,
      }),
    });
  };

  const connectedCount = page.props.resources.length;

  return (
    <ServerLayout>
      <Head title={`Resources - ${page.props.site.domain}`} />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <div className="flex items-center gap-2.5">
            <Heading title="Resources" />
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {connectedCount} of 3 connected
            </Badge>
          </div>
          {page.props.site.status !== 'installation_failed' && <SiteBanners site={page.props.site} compact />}
        </HeaderContainer>

        {page.props.site.status === 'installation_failed' && <SiteBanners site={page.props.site} />}

        <div className="flex w-full flex-col gap-4">
          <Card className="w-full transition-shadow">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-muted/60 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <DatabaseIcon className="size-4.5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">Database</CardTitle>
                    {dbResource ? (
                      <Badge variant={dbResource.status_color}>
                        {dbResource.status === 'connecting' && <LoaderCircleIcon className="mr-1 size-3 animate-spin" />}
                        {dbResource.status === 'ready' ? 'Connected' : dbResource.status}
                      </Badge>
                    ) : isDbInstalling ? (
                      <Badge variant="warning">
                        <LoaderCircleIcon className="mr-1 size-3 animate-spin" />
                        Installing...
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        Not configured
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs truncate">
                    {dbResource
                      ? `${getResourceTitle(dbResource)} · ${dbResource.server?.name ?? 'Server'} (${dbResource.server?.ip ?? ''})`
                      : 'PostgreSQL or MySQL database with dedicated user and automatic .env configuration.'}
                  </CardDescription>
                </div>
              </div>

              {dbResource && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => copyEnv(dbResource)}
                  >
                    <CopyIcon className="size-3.5" />
                    <span>Copy .env</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleExpanded(dbResource.id)}
                  >
                    {!collapsedIds[dbResource.id] ? (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => disconnectResource(dbResource)}
                    aria-label="Disconnect database"
                    title="Disconnect database from site"
                  >
                    <UnlinkIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>

            {dbResource ? (
              !collapsedIds[dbResource.id] &&
              dbResource.environment &&
              Object.keys(dbResource.environment).length > 0 && (
                <CardContent className="border-t border-border/50 bg-muted/10 p-4 pt-3">
                  <ResourceCredentialsView
                    environment={dbResource.environment}
                    type="database"
                    title={null}
                  />
                </CardContent>
              )
            ) : (
              <CardContent className="border-t border-border/50 p-4 pt-3">
                {isDbInstalling ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin text-primary shrink-0" />
                    <span>
                      Installing PostgreSQL on {selectedDbServer?.name ?? 'server'} ({selectedDbServer?.database_status ?? 'in progress'})… Vito will connect the database automatically once installation completes.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                      {dbServers.length > 1 ? (
                        <>
                          <span className="text-xs font-medium text-foreground shrink-0">Server:</span>
                          <Select value={selectedDbServerId} onValueChange={setSelectedDbServerId}>
                            <SelectTrigger className="w-full sm:w-[260px] h-8 text-xs">
                              <SelectValue placeholder="Select server" />
                            </SelectTrigger>
                            <SelectContent>
                              {dbServers.map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()}>
                                  {s.id === page.props.server.id ? `This server (${s.name})` : s.name} · {s.ip}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isDbReady
                            ? `Database service is installed and ready on this server (${page.props.server.name}).`
                            : `PostgreSQL is not installed on this server (${page.props.server.name}).`}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isDbReady ? (
                        <Button
                          size="sm"
                          disabled={isConnecting}
                          onClick={() => connectResource({ type: 'database', serverId: selectedDbServerId })}
                        >
                          {isConnecting ? (
                            <LoaderCircleIcon className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <PlusIcon className="mr-1 size-3.5" />
                          )}
                          Connect Database
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isInstalling || isConnecting}
                          onClick={() => installAndConnect('database', selectedDbServerId)}
                        >
                          {isInstalling || isConnecting ? (
                            <LoaderCircleIcon className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <PlusIcon className="mr-1 size-3.5" />
                          )}
                          Install PostgreSQL &amp; Connect
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card className="w-full transition-shadow">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-muted/60 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <LayersIcon className="size-4.5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">Cache &amp; Queue (Redis)</CardTitle>
                    {cacheResource ? (
                      <Badge variant={cacheResource.status_color}>
                        {cacheResource.status === 'connecting' && <LoaderCircleIcon className="mr-1 size-3 animate-spin" />}
                        {cacheResource.status === 'ready' ? 'Connected' : cacheResource.status}
                      </Badge>
                    ) : isCacheInstalling ? (
                      <Badge variant="warning">
                        <LoaderCircleIcon className="mr-1 size-3 animate-spin" />
                        Installing...
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        Not configured
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs truncate">
                    {cacheResource
                      ? `Redis · ${cacheResource.server?.name ?? 'Server'} (${cacheResource.server?.ip ?? ''})`
                      : 'Redis service for fast application caching, sessions, and background workers.'}
                  </CardDescription>
                </div>
              </div>

              {cacheResource && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => copyEnv(cacheResource)}
                  >
                    <CopyIcon className="size-3.5" />
                    <span>Copy .env</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleExpanded(cacheResource.id)}
                  >
                    {!collapsedIds[cacheResource.id] ? (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => disconnectResource(cacheResource)}
                    aria-label="Disconnect Redis"
                    title="Disconnect Redis from site"
                  >
                    <UnlinkIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>

            {cacheResource ? (
              !collapsedIds[cacheResource.id] &&
              cacheResource.environment &&
              Object.keys(cacheResource.environment).length > 0 && (
                <CardContent className="border-t border-border/50 bg-muted/10 p-4 pt-3">
                  <ResourceCredentialsView
                    environment={cacheResource.environment}
                    type="cache"
                    title={null}
                  />
                </CardContent>
              )
            ) : (
              <CardContent className="border-t border-border/50 p-4 pt-3">
                {isCacheInstalling ? (
                  <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin text-primary shrink-0" />
                    <span>
                      Installing Redis on {selectedCacheServer?.name ?? 'server'} ({selectedCacheServer?.cache_status ?? 'in progress'})… Vito will connect automatically once ready.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                      {cacheServers.length > 1 ? (
                        <>
                          <span className="text-xs font-medium text-foreground shrink-0">Server:</span>
                          <Select value={selectedCacheServerId} onValueChange={setSelectedCacheServerId}>
                            <SelectTrigger className="w-full sm:w-[260px] h-8 text-xs">
                              <SelectValue placeholder="Select server" />
                            </SelectTrigger>
                            <SelectContent>
                              {cacheServers.map((s) => (
                                <SelectItem key={s.id} value={s.id.toString()}>
                                  {s.id === page.props.server.id ? `This server (${s.name})` : s.name} · {s.ip}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {isCacheReady
                            ? `Redis service is installed and ready on this server (${page.props.server.name}).`
                            : `Redis is not installed on this server (${page.props.server.name}).`}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {isCacheReady ? (
                        <Button
                          size="sm"
                          disabled={isConnecting}
                          onClick={() => connectResource({ type: 'cache', serverId: selectedCacheServerId })}
                        >
                          {isConnecting ? (
                            <LoaderCircleIcon className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <PlusIcon className="mr-1 size-3.5" />
                          )}
                          Connect Redis
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isInstalling || isConnecting}
                          onClick={() => installAndConnect('cache', selectedCacheServerId)}
                        >
                          {isInstalling || isConnecting ? (
                            <LoaderCircleIcon className="mr-1 size-3.5 animate-spin" />
                          ) : (
                            <PlusIcon className="mr-1 size-3.5" />
                          )}
                          Install Redis &amp; Connect
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card className="w-full transition-shadow">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="bg-muted/60 text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <HardDriveIcon className="size-4.5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-semibold">Object Storage</CardTitle>
                    {storageResource ? (
                      <Badge variant={storageResource.status_color}>
                        {storageResource.status === 'connecting' && <LoaderCircleIcon className="mr-1 size-3 animate-spin" />}
                        {storageResource.status === 'ready' ? 'Connected' : storageResource.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        Not configured
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs truncate">
                    {storageResource
                      ? `${storageResource.storage_provider?.name ?? 'Storage'} (${(storageResource.storage_provider?.provider ?? 'S3').toUpperCase()}) · Object Storage`
                      : 'Connect AWS S3, Cloudflare R2, MinIO, or DigitalOcean Spaces for file uploads.'}
                  </CardDescription>
                </div>
              </div>

              {storageResource && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => copyEnv(storageResource)}
                  >
                    <CopyIcon className="size-3.5" />
                    <span>Copy .env</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={() => toggleExpanded(storageResource.id)}
                  >
                    {!collapsedIds[storageResource.id] ? (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => disconnectResource(storageResource)}
                    aria-label="Disconnect storage"
                    title="Disconnect storage from site"
                  >
                    <UnlinkIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </CardHeader>

            {storageResource ? (
              !collapsedIds[storageResource.id] &&
              storageResource.environment &&
              Object.keys(storageResource.environment).length > 0 && (
                <CardContent className="border-t border-border/50 bg-muted/10 p-4 pt-3">
                  <ResourceCredentialsView
                    environment={storageResource.environment}
                    type="storage"
                    title={null}
                  />
                </CardContent>
              )
            ) : (
              <CardContent className="border-t border-border/50 p-4 pt-3">
                {page.props.storageProviders.length > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-foreground shrink-0">Provider:</span>
                      <Select
                        value={selectedStorageProviderId}
                        onValueChange={setSelectedStorageProviderId}
                      >
                        <SelectTrigger className="w-full sm:w-[260px] h-8 text-xs">
                          <SelectValue placeholder="Select storage provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {page.props.storageProviders.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id.toString()}>
                              {provider.name} ({provider.provider.toUpperCase()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      size="sm"
                      disabled={!selectedStorageProviderId || isConnecting}
                      onClick={() =>
                        connectResource({
                          type: 'storage',
                          storageProviderId: selectedStorageProviderId,
                        })
                      }
                    >
                      {isConnecting ? (
                        <LoaderCircleIcon className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <PlusIcon className="mr-1 size-3.5" />
                      )}
                      Connect Storage
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      No storage providers configured yet. Connect AWS S3, Cloudflare R2, or MinIO in Settings.
                    </p>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={route('storage-providers')}>
                        <ExternalLinkIcon className="mr-1 size-3.5" />
                        Configure Storage
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
