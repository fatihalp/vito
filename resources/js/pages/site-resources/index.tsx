import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDialog } from '@/hooks/use-dialog';
import ServerLayout from '@/layouts/server/layout';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import type { SiteResource, SiteResourceServerOption } from '@/types/site-resource';
import type { Bucket } from '@/types/bucket';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { BoxesIcon, DatabaseIcon, EyeIcon, HardDriveIcon, InfoIcon, KeyIcon, LayersIcon, LoaderCircleIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

type ResourceType = SiteResource['type_value'];

const resourceTypes: Array<{ value: ResourceType; label: string; description: string }> = [
  { value: 'database', label: 'Database server', description: 'Creates an isolated database and user, enables networking and writes DB_* variables.' },
  { value: 'cache', label: 'Cache (Redis) server', description: 'Enables protected Redis networking and writes the cache and REDIS_* variables.' },
  { value: 'bucket', label: 'Bucket', description: 'Writes the standard Laravel filesystem and AWS_* variables from an encrypted bucket connection.' },
];

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
    buckets: Bucket[];
    credentialsConnected?: boolean;
  }>();
  const dialog = useDialog();
  const connectedTypes = new Set(page.props.resources.map((resource) => resource.type_value));
  const availableTypes = resourceTypes.filter((type) => !connectedTypes.has(type.value));
  const [isCreatingBucket, setIsCreatingBucket] = useState(page.props.buckets.length === 0);
  const form = useForm<{ type: ResourceType | ''; server_id: string; bucket_id: string; bucket_name: string }>({
    type: '',
    server_id: '',
    bucket_id: '',
    bucket_name: '',
  });
  const selectedDefinition = resourceTypes.find((type) => type.value === form.data.type);
  const matchingServers = form.data.type === 'bucket' || form.data.type === ''
    ? []
    : page.props.servers.filter((server) => server.role_value === form.data.type);
  const targetSelected = form.data.type === 'bucket'
    ? (isCreatingBucket || page.props.buckets.length === 0 ? form.data.bucket_name.trim().length >= 3 : form.data.bucket_id !== '')
    : form.data.server_id !== '';

  useEffect(() => {
    if (!page.props.resources.some((resource) => resource.status === 'connecting')) {
      return;
    }

    const interval = window.setInterval(() => {
      router.reload({ only: ['resources'] });
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [page.props.resources]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(route('site-resources.store', { server: page.props.server.id, site: page.props.site.id }), {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        setIsCreatingBucket(page.props.buckets.length === 0);
      },
    });
  };

  return (
    <ServerLayout>
      <Head title={`Resources - ${page.props.site.domain}`} />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Resources" description="Attach dedicated infrastructure to this site and let Vito maintain its environment configuration." />
          <SiteBanners site={page.props.site} compact />
        </HeaderContainer>

        {page.props.site.status === 'installation_failed' && <SiteBanners site={page.props.site} />}

        <Card>
          <CardHeader>
            <CardTitle>Connect a resource</CardTitle>
            <CardDescription>Only ready servers with the matching server type can be selected.</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {availableTypes.length > 0 ? (
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="resource-type">Resource type</Label>
                  <Select
                    value={form.data.type}
                    onValueChange={(value: ResourceType) => {
                      form.setData({ type: value, server_id: '', bucket_id: '', bucket_name: '' });
                      if (value === 'bucket') {
                        setIsCreatingBucket(page.props.buckets.length === 0);
                      }
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="resource-target">Target</Label>
                    {form.data.type === 'bucket' && page.props.buckets.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingBucket(!isCreatingBucket);
                          form.setData({ ...form.data, bucket_id: '', bucket_name: '' });
                        }}
                        className="text-primary hover:underline text-xs"
                      >
                        {isCreatingBucket ? 'Select existing bucket' : '+ Create new bucket'}
                      </button>
                    )}
                  </div>
                  {form.data.type === 'bucket' ? (
                    isCreatingBucket || page.props.buckets.length === 0 ? (
                      <Input
                        id="resource-target"
                        placeholder="Bucket name (e.g. my-app-uploads)"
                        value={form.data.bucket_name}
                        onChange={(e) => form.setData('bucket_name', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="font-mono"
                        autoComplete="off"
                      />
                    ) : (
                      <Select value={form.data.bucket_id} onValueChange={(value) => form.setData('bucket_id', value)}>
                        <SelectTrigger id="resource-target">
                          <SelectValue placeholder="Select a bucket" />
                        </SelectTrigger>
                        <SelectContent>
                          {page.props.buckets.map((bucket) => (
                            <SelectItem key={bucket.id} value={bucket.id.toString()}>{bucket.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )
                  ) : (
                    <Select value={form.data.server_id} onValueChange={(value) => form.setData('server_id', value)} disabled={form.data.type === ''}>
                      <SelectTrigger id="resource-target">
                        <SelectValue placeholder="Select a server" />
                      </SelectTrigger>
                      <SelectContent>
                        {matchingServers.map((server) => (
                          <SelectItem key={server.id} value={server.id.toString()}>{server.name} · {server.ip}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <InputError message={form.errors.server_id || form.errors.bucket_id || form.errors.bucket_name} />
                </div>

                <Button type="submit" disabled={!form.data.type || !targetSelected || form.processing}>
                  {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
                  Connect
                </Button>

                {selectedDefinition && (
                  <p className="text-muted-foreground text-sm md:col-span-3">{selectedDefinition.description}</p>
                )}
                {form.data.type === 'bucket' && (isCreatingBucket || page.props.buckets.length === 0) && (
                  page.props.credentialsConnected === false ? (
                    <Alert className="md:col-span-3">
                      <KeyIcon className="size-4" />
                      <AlertDescription className="flex items-center justify-between gap-4">
                        <span>Connect your Hetzner Object Storage credentials to create buckets.</span>
                        <Button size="sm" variant="outline" type="button" onClick={() => dialog.bucketCredentialsConnect.open({})}>
                          Connect credentials
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-muted-foreground text-xs md:col-span-3">
                      Bucket will be automatically provisioned on Hetzner (Falkenstein, private visibility) and configured for Laravel (AWS_*).
                    </p>
                  )
                )}
                {form.data.type && form.data.type !== 'bucket' && matchingServers.length === 0 && (
                  <Alert className="md:col-span-3">
                    <InfoIcon />
                    <AlertDescription>No ready {selectedDefinition?.label.toLowerCase()} is available in this project.</AlertDescription>
                  </Alert>
                )}
              </form>
            ) : (
              <p className="text-muted-foreground text-sm">All supported resource types are connected.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {page.props.resources.map((resource) => {
            const ResourceIcon = typeIcon(resource.type_value);
            const target = resource.server?.name ?? resource.bucket?.name ?? 'Unavailable resource';
            const targetDetail = resource.server
              ? `${resource.server.role} · ${resource.server.ip}`
              : resource.bucket
                ? `${resource.bucket.bucket} · ${resource.bucket.region}`
                : 'The connected resource is no longer available';

            return (
              <Card key={resource.id}>
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
                <CardContent className="grid gap-3 p-4">
                  <div className="flex flex-wrap gap-1.5">
                    {resource.environment_keys.map((key) => (
                      <Badge key={key} variant="outline" className="font-mono">{key}</Badge>
                    ))}
                  </div>
                  <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    <BoxesIcon className="size-3.5" />
                    {resource.status === 'ready'
                      ? "Managed automatically in the site's environment file"
                      : resource.status === 'connecting'
                        ? 'Networking is being configured before environment activation'
                        : 'Connection failed before environment activation; disconnect it and try again'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {page.props.resources.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground flex min-h-32 items-center justify-center p-6 text-sm">No resources connected to this site yet.</CardContent>
          </Card>
        )}
      </Container>
    </ServerLayout>
  );
}
