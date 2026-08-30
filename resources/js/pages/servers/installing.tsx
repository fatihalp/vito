import type { Server } from '@/types/server';
import type { ServerLog } from '@/types/server-log';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/server-logs/components/columns';
import { Deferred, usePage } from '@inertiajs/react';
import Heading from '@/components/heading';
import { PaginatedData } from '@/types';
import { useRealtime } from '@/hooks/use-socket-events';
import { TableSkeleton } from '@/components/table-skeleton';

function InstallingLogs({ serverId, initialLogs }: { serverId: number; initialLogs: PaginatedData<ServerLog> }) {
  const [logs] = useRealtime<ServerLog>(initialLogs, 'server-log', { server_id: serverId });

  return <DataTable columns={columns} paginatedData={logs} />;
}

export default function InstallingServer() {
  const page = usePage<{
    server: Server;
    logs: PaginatedData<ServerLog>;
  }>();

  return (
    <Container className="max-w-5xl">
      <Heading title="Installing" description="Here you can see the installation logs" />
      <Deferred data="logs" fallback={<TableSkeleton cells={4} rows={5} />}>
        <InstallingLogs serverId={page.props.server.id} initialLogs={page.props.logs} />
      </Deferred>
    </Container>
  );
}
