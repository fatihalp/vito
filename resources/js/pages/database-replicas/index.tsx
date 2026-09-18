import { Head, Link, usePage } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Server } from '@/types/server';
import { DatabaseReplica, PostgresCluster } from '@/types/database-replica';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VitoTable } from '@/components/vito-table';
import ServerLayout from '@/layouts/server/layout';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import DatabaseReplicaActions from '@/pages/database-replicas/components/database-replica-actions';

type Page = {
  server: Server;
  cluster: PostgresCluster | null;
  replicas: InertiaTableData;
};

export default function DatabaseReplicas() {
  const page = usePage<Page>();
  const dialog = useDialog();
  const { cluster, server } = page.props;
  const isPrimary = !cluster || cluster.primary_server_id === server.id;
  const backup = cluster?.backup;

  const details: [string, React.ReactNode][] = cluster
    ? [
        ['Primary', cluster.primary_server_name],
        ...(cluster.network ? [] : [['Private network', 'created with the first replica'] as [string, React.ReactNode]]),
        ['Backups', backup ? `${backup.pgbackrest?.strategy === 'custom' ? 'Custom' : 'Standard'} strategy on ${backup.storage?.profile ?? 'S3'}` : 'none'],
        ['Backups run on', cluster.backups_from_replicas ? 'a healthy replica, else the primary' : 'the primary'],
        ['Last verify', backup?.pgbackrest?.last_verify_result ?? 'not yet'],
        ['TLS certificates expire', cluster.tls_expires_at ? new Date(cluster.tls_expires_at).toLocaleDateString() : '-'],
      ]
    : [];

  return (
    <ServerLayout>
      <Head title={`Replication - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Replication" description="PostgreSQL streaming replicas built from pgBackRest backups, checked every minute." />
          <div className="flex items-center gap-2">
            {cluster && <Badge variant={cluster.status_color}>{cluster.status}</Badge>}
            {isPrimary ? (
              <Button onClick={() => dialog.databaseReplicaCreate.open({ server, cluster })} disabled={cluster?.status === 'failing_over'}>
                <PlusIcon />
                <span className="hidden lg:block">Create replica</span>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={route('database-replicas', { server: cluster.primary_server_id })}>Go to primary</Link>
              </Button>
            )}
          </div>
        </HeaderContainer>

        {cluster?.failover && (
          <Alert variant={cluster.failover.error ? 'destructive' : 'default'}>
            <AlertTitle>{cluster.failover.error ? 'Failover stopped' : 'Failing over'}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {cluster.failover.error
                  ? `Stopped after step "${cluster.failover.step}": ${cluster.failover.error}. Everything done so far is kept; continuing resumes from this step.`
                  : `Current step: ${cluster.failover.step}. Backups and replica changes are paused until it finishes.`}
              </span>
              {cluster.failover.error && (
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      dialog.confirm.open({
                        title: 'Continue failover',
                        description: 'Vito continues from the last finished step. It does not stop the old primary or promote the replica again.',
                        confirmLabel: 'Continue',
                        method: 'post',
                        url: route('database-replicas.failover.retry', { server: server.id }),
                      })
                    }
                  >
                    Continue failover
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {cluster && (
          <Card>
            <CardContent className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {cluster?.network && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    Private network {cluster.network.name}
                    <Badge variant={cluster.network.type === 'wireguard' ? 'success' : 'info'}>{cluster.network.kind}</Badge>
                  </p>
                  <p className="text-muted-foreground">
                    {cluster.network.type === 'wireguard'
                      ? `Encrypted WireGuard tunnels between the servers${cluster.network.managed ? ', created by Vito for this cluster' : ''}`
                      : cluster.network.type === 'provider'
                        ? "Traffic stays on the provider's private network"
                        : 'Private addresses you assigned to the servers'}
                    {cluster.network.cidr ? ` · ${cluster.network.cidr}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={route('networks.servers', { network: cluster.network.id })}>Open network</Link>
                </Button>
              </div>
              {cluster.network.nodes.map((node) => (
                <div key={node.server_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <span>
                    {node.name} <span className="text-muted-foreground">({node.role})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{node.ip ?? '-'}</span>
                    {node.connected === null ? (
                      <Badge variant="gray">{node.status}</Badge>
                    ) : (
                      <Badge variant={node.connected ? 'success' : 'danger'}>
                        {node.connected ? 'connected' : 'no recent handshake'}
                      </Badge>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <VitoTable
          tableData={page.props.replicas}
          actions={(row: Row) => <DatabaseReplicaActions replica={asRow<{ resource: DatabaseReplica }>(row, ['resource']).resource} failoverEnabled={cluster?.failover_enabled} />}
        />
      </Container>
    </ServerLayout>
  );
}
