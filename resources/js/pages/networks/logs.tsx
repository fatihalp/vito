import { useTranslate } from '@/hooks/use-translate';
import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import NetworkLayout from '@/layouts/network/layout';
import { DataTable } from '@/components/data-table';
import { networkLogColumns } from '@/pages/networks/components/log-columns';
import { useRealtime, useRealtimeRecord } from '@/hooks/use-socket-events';
import { PaginatedData } from '@/types';
import { ServerLog } from '@/types/server-log';
import { Network } from '@/types/network';

export default function NetworkLogs() {
  const translateText = useTranslate();
  const page = usePage<{ network: Network; logs: PaginatedData<ServerLog> }>();
  const network = useRealtimeRecord<Network>(page.props.network, 'network')!;
  const [logs] = useRealtime<ServerLog>(page.props.logs, 'server-log', { network_id: network.id });

  return (
    <NetworkLayout>
      <Head title={translateText("Logs - :value", { value: network.name })} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('Logs')} description={translateText("Activity recorded against this network and the servers it runs on")} />
        </HeaderContainer>

        <DataTable columns={networkLogColumns} paginatedData={logs} searchable sortable />
      </Container>
    </NetworkLayout>
  );
}
