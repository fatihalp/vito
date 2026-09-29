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

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  const page = usePage<Page>();
  const dialog = useDialog();
  const usesHost = page.props.usesHost;

  return (
    <ServerLayout>
      <Head title={`Users - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title={
              page.props.server.counts?.database_users !== undefined
                ? `Users (${page.props.server.counts.database_users})`
                : 'Users'
            }
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                dialog.confirm.open({
                  title: 'Sync users',
                  description:
                    'This action will connect to your server and perform a two-way synchronization of database users. Vito will fetch any database users created manually on the server, and verify the existence of users managed by Vito. If a user tracked by Vito no longer exists on the server, it will be removed from Vito. Are you sure you want to proceed?',
                  confirmLabel: 'Sync users',
                  url: route('database-users.sync', { server: page.props.server.id }),
                  method: 'post',
                })
              }
            >
              Sync
            </Button>
            {!page.props.replicaOf && (
              <CreateDatabaseUser server={page.props.server.id} usesHost={usesHost}>
                <Button>
                  <PlusIcon />
                  <span className="hidden lg:block">Create</span>
                </Button>
              </CreateDatabaseUser>
            )}
          </div>
        </HeaderContainer>

        {page.props.replicaOf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>This server is a PostgreSQL replica of {page.props.replicaOf.name}</AlertTitle>
            <AlertDescription>
              <p>
                Everything here is a copy of {page.props.replicaOf.name} and is read-only, so create and delete on the primary. Vito imports the list when
                the replica is built; use Sync to refresh it.
              </p>
              {page.props.replicaOf.server_id && (
                <Link href={route('database-users', { server: page.props.replicaOf.server_id })} className="text-foreground underline">
                  Open the primary
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
                    <DropdownMenuItem onSelect={() => dialog.databaseUserEdit.open({ databaseUser, usesHost })}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => dialog.databaseUserLink.open({ databaseUser })}>Link</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        dialog.confirm.open({
                          title: `Delete database user [${databaseUser.username}]`,
                          description: `Are you sure you want to delete database user ${databaseUser.username}? This action cannot be undone.`,
                          variant: 'destructive',
                          confirmLabel: 'Delete',
                          method: 'delete',
                          url: route('database-users.destroy', { server: databaseUser.server_id, databaseUser: databaseUser.id }),
                        })
                      }
                    >
                      Delete
                    </DropdownMenuItem>
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
