import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDialog } from '@/hooks/use-dialog';
import Layout from '@/layouts/app/layout';
import type { Bucket } from '@/types/bucket';
import { Head, usePage } from '@inertiajs/react';
import { EyeIcon, KeyIcon, PlusIcon, ShieldCheckIcon, TrashIcon, UnlinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Buckets() {
  const page = usePage<{ buckets: Bucket[]; credentialsConnected: boolean }>();
  const dialog = useDialog();
  const { buckets, credentialsConnected } = page.props;

  return (
    <Layout>
      <Head title="Buckets" />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Buckets" description="Provision and manage Hetzner Object Storage buckets for this project." />
        </HeaderContainer>

        <Alert>
          <ShieldCheckIcon />
          <AlertDescription>Access credentials are encrypted and are only written to sites you explicitly connect.</AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>Hetzner Object Storage</CardTitle>
              <div className="text-muted-foreground text-sm">
                {credentialsConnected ? 'Credentials connected.' : 'Connect your project-wide access key to start creating buckets.'}
              </div>
            </div>
            {credentialsConnected ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">
                  <ShieldCheckIcon />
                  Connected
                </Badge>
                <Button variant="outline" onClick={() => dialog.bucketCredentialsConnect.open({})}>
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    dialog.confirm.open({
                      title: 'Disconnect Hetzner Object Storage',
                      description:
                        'This only removes the connection in Vito. Buckets already created here keep working — they hold their own copy of the credentials.',
                      confirmLabel: 'Disconnect',
                      variant: 'destructive',
                      method: 'delete',
                      url: route('buckets.credentials.destroy'),
                    })
                  }
                >
                  <UnlinkIcon />
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={() => dialog.bucketCredentialsConnect.open({})}>
                <KeyIcon />
                Connect
              </Button>
            )}
          </CardHeader>
        </Card>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold tracking-tight">Buckets</h3>
          {credentialsConnected ? (
            <Button onClick={() => dialog.bucketCreate.open({})}>
              <PlusIcon />
              New bucket
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled>
                    <PlusIcon />
                    New bucket
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Connect your Hetzner Object Storage credentials first.</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {buckets.map((bucket) => (
            <Card key={bucket.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="truncate font-mono">{bucket.name}</CardTitle>
                  <div className="text-muted-foreground truncate text-sm">{bucket.region}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={bucket.visibility === 'public' ? 'default' : 'outline'}>{bucket.visibility}</Badge>
                  <Button variant="ghost" size="icon" aria-label={`View credentials for ${bucket.name}`} onClick={() => dialog.bucketCredentialsReveal.open({ bucket })}>
                    <EyeIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${bucket.name}`}
                    onClick={() =>
                      dialog.confirm.open({
                        title: `Delete bucket connection ${bucket.name}?`,
                        description:
                          'This removes the connection in Vito only — the bucket and its data are not deleted on Hetzner. Connected sites will have the managed bucket variables removed and their previous values restored.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                        method: 'delete',
                        url: route('buckets.destroy', { bucket: bucket.id }),
                      })
                    }
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {buckets.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground flex min-h-32 items-center justify-center p-6 text-sm">No buckets yet.</CardContent>
          </Card>
        )}
      </Container>
    </Layout>
  );
}
