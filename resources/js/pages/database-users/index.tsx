import { useTranslate } from '@/hooks/use-translate';
import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { DatabaseUser } from '@/types/database-user';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import { VitoTable } from '@/components/vito-table';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { InfoIcon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CreateDatabaseUser from '@/pages/database-users/components/create-database-user';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { asRow } from '@/lib/inertia-table';

type Page = {
  server: Server;
  databaseUsers: InertiaTableData;
  usesHost: boolean;
  replicaOf?: { server_id: number; name: string | null } | null;
};

export default function DatabaseUsers() {
  const translateText = useTranslate();
  const page = usePage<Page>();
  const dialog = useDialog();
  const usesHost = page.props.usesHost;

  return (
    <ServerLayout>
      <Head title={translateText("Users - :value", { value: page.props.server.name })} />

      <Container>
        <HeaderContainer>
          <Heading
            title={
              page.props.server.counts?.database_users !== undefined
                ? `Users (${page.props.server.counts.database_users})`
                : translateText("Users")
            }
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                dialog.confirm.open({
                  title: 'Sync users',
                  description:
                    'This action will connect to your server and perform a two-way synchronization of database users. Pure will fetch any database users created manually on the server, and verify the existence of users managed by Pure. If a user tracked by Pure no longer exists on the server, it will be removed from Pure. Are you sure you want to proceed?',
                  confirmLabel: 'Sync users',
                  url: `/servers/${page.props.server.id}/database/users/sync`,
                  method: 'post',
                })
              }
            >
              {translateText('Sync')}
            </Button>
            {!page.props.replicaOf && (
              <CreateDatabaseUser server={page.props.server.id} usesHost={usesHost}>
                <Button>
                  <PlusIcon />
                  <span className="hidden lg:block">{translateText('Create')}</span>
                </Button>
              </CreateDatabaseUser>
            )}
          </div>
        </HeaderContainer>

        {page.props.replicaOf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>{translateText('This server is a PostgreSQL replica of')} {page.props.replicaOf.name}</AlertTitle>
            <AlertDescription>
              <p>
                {translateText("Everything here is a copy of")} {page.props.replicaOf.name} {translateText("and is read-only, so create and delete on the primary. Pure imports the list when the replica is built; use Sync to refresh it.")}
              </p>
              {page.props.replicaOf.server_id && (
                <Link href={`/servers/${page.props.replicaOf.server_id}/database/users`} className="text-foreground underline">
                  {translateText("Open the primary")}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <VitoTable
          tableData={page.props.databaseUsers}
          actions={(row: Row) => {
            const databaseUser = asRow<DatabaseUser>(row, ['id', 'username', 'server_id', 'permission', 'databases', 'host']);
            return (
              <div className="flex items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <TableActionTrigger />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => dialog.databaseUserEdit.open({ databaseUser, usesHost })}>{translateText('Edit')}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => dialog.databaseUserLink.open({ databaseUser })}>{translateText('Link')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }}
        />
      </Container>
    </ServerLayout>
  );
}
