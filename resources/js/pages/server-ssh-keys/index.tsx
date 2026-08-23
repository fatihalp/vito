import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { VitoTable } from '@/components/vito-table';
import { SshKey } from '@/types/ssh-key';
import { Server } from '@/types/server';
import DeployKey from '@/pages/server-ssh-keys/components/deploy-key';
import Delete from '@/pages/server-ssh-keys/components/delete';
import ConnectSshDialog from '@/pages/servers/components/connect-ssh-dialog';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RocketIcon } from 'lucide-react';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { asRow } from '@/lib/inertia-table';

type Page = {
  sshKeys: InertiaTableData;
  server: Server;
};

export default function SshKeys() {
  const page = usePage<Page>();
  const server = page.props.server;

  return (
    <ServerLayout>
      <Head title="SSH Keys" />
      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="SSH Keys" description="Here you can manage the ssh keys deployed to the server" />
          <div className="flex items-center gap-2">
            {server && <ConnectSshDialog server={server} />}
            <DeployKey>
              <Button>
                <RocketIcon />
                Deploy key
              </Button>
            </DeployKey>
          </div>
        </HeaderContainer>

        <VitoTable
          tableData={page.props.sshKeys}
          actions={(row: Row) => (
            <div className="flex items-center gap-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <TableActionTrigger />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <Delete sshKey={asRow<SshKey>(row, ['id', 'name'])} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        />
      </Container>
    </ServerLayout>
  );
}
