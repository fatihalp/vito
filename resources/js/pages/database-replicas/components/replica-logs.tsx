import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import LogOutput from '@/components/log-output';
import Logs from '@/pages/server-logs/components/logs';
import { DatabaseReplica } from '@/types/database-replica';
import { Server } from '@/types/server';

type Tab = 'restore' | 'replica' | 'primary';

export default function ReplicaLogs({ replica }: { replica: DatabaseReplica }) {
  const [tab, setTab] = useState<Tab>(replica.status === 'seeding' || replica.status === 'failed' ? 'restore' : 'replica');

  const restore = useQuery({
    queryKey: ['databaseReplicaRestoreOutput', replica.id],
    queryFn: async () =>
      (await axios.get<{ content: string }>(route('database-replicas.seed-output', { server: replica.primary_server_id, databaseReplica: replica.id }))).data
        .content,
    enabled: tab === 'restore',
    refetchInterval: replica.status === 'seeding' ? 10000 : false,
  });

  const tabs: [Tab, string][] = [
    ['restore', 'Restore output'],
    ['replica', `Logs on ${replica.replica_server_name}`],
    ['primary', `Logs on ${replica.primary_server_name}`],
  ];

  return (
    <section id="logs" className="flex flex-col gap-3" aria-label="Replica logs">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Logs</h3>
        <p className="text-muted-foreground text-sm">
          Every command Vito runs for this replica is logged on the server it ran on: network, firewall, pg_hba.conf, pgBackRest and certificates. The
          restore output comes straight from the restore process on the replica.
        </p>
      </div>
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map(([key, label]) => (
          <Button key={key} size="sm" role="tab" aria-selected={tab === key} variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>
      {tab === 'restore' && (
        <LogOutput>
          {restore.isError ? 'Unable to load the restore output.' : restore.isLoading ? 'Loading...' : (restore.data ?? '')}
        </LogOutput>
      )}
      {tab === 'replica' && <Logs server={{ id: replica.replica_server_id } as Server} />}
      {tab === 'primary' && <Logs server={{ id: replica.primary_server_id } as Server} />}
    </section>
  );
}
