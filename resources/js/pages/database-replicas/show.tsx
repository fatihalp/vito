import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import ServerLayout from '@/layouts/server/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { formatBytes } from '@/lib/utils';
import { ResourceUsageChart } from '@/pages/monitoring/components/resource-usage-chart';
import DatabaseReplicaActions from '@/pages/database-replicas/components/database-replica-actions';
import ReplicaLogs from '@/pages/database-replicas/components/replica-logs';
import { DatabaseReplica, DatabaseReplicaMetric, PostgresCluster } from '@/types/database-replica';

type Page = {
  replica: DatabaseReplica;
  cluster: PostgresCluster;
  metrics: DatabaseReplicaMetric[];
  period: string;
};

const PERIODS = ['1h', '24h', '7d', '30d'];

const formatLatency = (value: unknown): string => {
  const ms = Number(value ?? 0);
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
};

const formatByteValue = (value: unknown): string => formatBytes(Number(value ?? 0), 1);

export default function ShowDatabaseReplica() {
  const page = usePage<Page>();
  const replica = useRealtimeRecord<DatabaseReplica>(page.props.replica, 'database-replica') ?? page.props.replica;
  const latest = replica.latest_metric;

  usePoll(60000, { only: ['replica', 'metrics'] });

  const details: [string, string | null | undefined][] = [
    ['Primary', replica.primary_server_name],
    ['Replica', `${replica.replica_server_name}${replica.private_address ? ` (${replica.private_address})` : ''}`],
    ['Private network', page.props.cluster.network?.name],
    ['Replication slot', replica.slot_name],
    ['Replication user', replica.username],
    ['WAL kept when disconnected', `${replica.max_slot_wal_keep_size_gb} GB`],
    ['Streaming state', latest?.state],
    ['Slot WAL status', latest?.slot_wal_status],
    ['Replay delay', latest?.replay_delay_seconds != null ? `${latest.replay_delay_seconds} s` : null],
    ['Last checked', replica.last_checked_at ? new Date(replica.last_checked_at).toLocaleString() : null],
  ];

  return (
    <ServerLayout>
      <Head title={`Replica ${replica.replica_server_name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title={`${replica.primary_server_name} → ${replica.replica_server_name}`} description="PostgreSQL streaming replica" />
          <div className="flex items-center gap-2">
            <Badge variant={replica.status_color}>{replica.status}</Badge>
            <Badge variant={replica.health_color}>{replica.health}</Badge>
            <DatabaseReplicaActions replica={replica} failoverEnabled={page.props.cluster.failover_enabled} />
          </div>
        </HeaderContainer>

        {replica.status === 'seeding' && (
          <span className="text-muted-foreground text-sm">Restoring from pgBackRest and replaying archived WAL. This can take a while for large clusters.</span>
        )}
        {replica.status === 'waiting_for_backup' && (
          <span className="text-muted-foreground text-sm">Waiting for the first full pgBackRest backup of the primary to finish.</span>
        )}

        {['pending', 'configuring', 'seeding'].includes(replica.status) && replica.setup_step && (
          <span className="text-muted-foreground text-sm">Current step: {replica.setup_step}.</span>
        )}

        {replica.message && (
          <p className={`${replica.status === 'failed' || replica.status === 'needs_rebuild' ? 'text-destructive' : 'text-muted-foreground'} text-sm whitespace-pre-line`}>
            {replica.message}{' '}
            {replica.status === 'failed' && (
              <a href="#logs" className="underline">
                View logs
              </a>
            )}
          </p>
        )}

        {replica.health_reasons.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4 text-sm">
              {replica.health_reasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right break-all">{value ?? '-'}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center gap-1">
          {PERIODS.map((period) => (
            <Button key={period} size="sm" variant={period === page.props.period ? 'default' : 'outline'} asChild>
              <Link href={route('database-replicas.show', { server: replica.primary_server_id, databaseReplica: replica.id, period })} preserveScroll>
                {period}
              </Link>
            </Button>
          ))}
        </div>

        {['pending', 'configuring', 'seeding', 'failed'].includes(replica.status) && <ReplicaLogs replica={replica} />}

        <div className="grid gap-4 md:grid-cols-2">
          <ResourceUsageChart title="Lag behind primary" label="Lag" color="var(--color-chart-1)" dataKey="lag_bytes" chartData={page.props.metrics} valueFormatter={formatByteValue} formatter={(value) => formatByteValue(value)} height="medium" showXAxis />
          <ResourceUsageChart title="Replay latency" label="Replay" color="var(--color-chart-2)" dataKey="replay_lag_ms" chartData={page.props.metrics} valueFormatter={formatLatency} formatter={(value) => formatLatency(value)} height="medium" showXAxis />
          <ResourceUsageChart title="Flush latency" label="Flush" color="var(--color-chart-3)" dataKey="flush_lag_ms" chartData={page.props.metrics} valueFormatter={formatLatency} formatter={(value) => formatLatency(value)} height="medium" showXAxis />
          <ResourceUsageChart title="WAL kept by the slot" label="Retained" color="var(--color-chart-4)" dataKey="slot_retained_bytes" chartData={page.props.metrics} valueFormatter={formatByteValue} formatter={(value) => formatByteValue(value)} height="medium" showXAxis />
        </div>
        {!['pending', 'configuring', 'seeding', 'failed'].includes(replica.status) && <ReplicaLogs replica={replica} />}
      </Container>
    </ServerLayout>
  );
}
