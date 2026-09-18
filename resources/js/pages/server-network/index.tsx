import { Head, Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Server } from '@/types/server';
import { ServerIpAddress } from '@/types/server-ip';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { PlusIcon, RefreshCwIcon } from 'lucide-react';
import Container from '@/components/container';
import { VitoTable } from '@/components/vito-table';
import { TableActionTrigger } from '@/components/table-action-trigger';
import Delete from '@/pages/server-network/components/delete';
import SetPrimary from '@/pages/server-network/components/set-primary';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { asRow } from '@/lib/inertia-table';
import { useDialog } from '@/hooks/use-dialog';
import { NetworkServer } from '@/types/network';
import { Badge } from '@/components/ui/badge';

const autoRefreshedServers = new Set<number>();

export default function ServerNetwork() {
  const page = usePage<{
    server: Server;
    ipAddresses: InertiaTableData;
    interfaces: string[];
    networks: NetworkServer[];
  }>();
  const dialog = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const serverId = page.props.server.id;

  const refresh = useCallback(() => {
    router.post(
      route('servers.network.refresh', { server: serverId }),
      {},
      {
        preserveScroll: true,
        onStart: () => setRefreshing(true),
        onFinish: () => setRefreshing(false),
      },
    );
  }, [serverId]);

  const isEmpty = page.props.ipAddresses.data.length === 0;
  useEffect(() => {
    if (isEmpty && !autoRefreshedServers.has(serverId)) {
      autoRefreshedServers.add(serverId);
      refresh();
    }
  }, [isEmpty, serverId, refresh]);

  return (
    <ServerLayout>
      <Head title={`Network - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Network" description="Here you can manage the IP addresses configured on the server" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Refresh" disabled={refreshing} onClick={refresh}>
              <RefreshCwIcon className={refreshing ? 'animate-spin' : undefined} />
            </Button>
            <Button onClick={() => dialog.serverIpForm.open({ serverId: page.props.server.id, interfaces: page.props.interfaces })}>
              <PlusIcon />
              <span className="hidden lg:block">Add IP</span>
            </Button>
          </div>
        </HeaderContainer>

        {page.props.networks.length > 0 && (
          <section className="flex flex-col gap-3" aria-label="Private networks">
            <h3 className="text-lg font-semibold">Private networks</h3>
            {page.props.networks.map((member) => (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border p-3 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  {member.network && (
                    <>
                      <Link href={route('networks.show', { network: member.network.id })} className="font-medium underline">
                        {member.network.name}
                      </Link>
                      <Badge variant={member.network.type === 'wireguard' ? 'success' : 'info'}>{member.network.kind}</Badge>
                    </>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{member.private_ip ?? member.ip ?? '-'}</span>
                  {member.connected === null ? (
                    <Badge variant={member.status_color}>{member.status}</Badge>
                  ) : (
                    <Badge variant={member.connected ? 'success' : 'danger'}>{member.connected ? 'connected' : 'no recent handshake'}</Badge>
                  )}
                </span>
              </div>
            ))}
          </section>
        )}

        <VitoTable
          tableData={page.props.ipAddresses}
          actions={(row: Row) => {
            const ipAddress = asRow<ServerIpAddress>(row, ['id', 'ip', 'server_id', 'is_managed', 'is_primary']);
            const canSetPrimary = !ipAddress.is_primary;
            const canDelete = ipAddress.is_managed && !ipAddress.is_primary;
            const hasActions = canSetPrimary || canDelete;
            return (
              <div className="flex items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <TableActionTrigger disabled={!hasActions} />
                  </DropdownMenuTrigger>
                  {hasActions && (
                    <DropdownMenuContent align="start">
                      {canSetPrimary && <SetPrimary ipAddress={ipAddress} />}
                      {canDelete && <Delete ipAddress={ipAddress} />}
                    </DropdownMenuContent>
                  )}
                </DropdownMenu>
              </div>
            );
          }}
        />
      </Container>
    </ServerLayout>
  );
}
