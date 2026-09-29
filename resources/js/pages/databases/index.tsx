import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import CreateDatabase from '@/pages/databases/components/create-database';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import { VitoTable } from '@/components/vito-table';
import { InfoIcon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { InertiaTableData } from '@forjedio/inertia-table-react';
import { useDialog } from '@/hooks/use-dialog';

type Page = {
  server: Server;
  databases: InertiaTableData;
  replicaOf?: { server_id: number; name: string | null } | null;
};

export default function Databases() {
  const page = usePage<Page>();
  const dialog = useDialog();

  const dbType = page.props.server.services['database'];
  const defaultCharset = dbType === 'postgresql' ? 'UTF8' : 'utf8mb4';
  const defaultCollation = dbType === 'postgresql' ? 'C.utf8' : 'utf8mb4_0900_ai_ci';

  return (
    <ServerLayout>
      <Head title={`Databases - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title={
              page.props.server.counts?.databases !== undefined
                ? `Databases (${page.props.server.counts.databases})`
                : 'Databases'
            }
          />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                dialog.confirm.open({
                  title: 'Sync databases',
                  description:
                    'This action will connect to your server and perform a two-way synchronization of databases. Vito will fetch any databases created manually on the server, and verify the existence of databases managed by Vito. If a database tracked by Vito no longer exists on the server, it will be removed from Vito. Are you sure you want to proceed?',
                  confirmLabel: 'Sync databases',
                  url: route('databases.sync', { server: page.props.server.id }),
                  method: 'post',
                })
              }
            >
              Sync
            </Button>
            {!page.props.replicaOf && (
              <CreateDatabase server={page.props.server.id} defaultCharset={defaultCharset} defaultCollation={defaultCollation}>
                <Button>
                  <PlusIcon />
                  <span className="hidden lg:block">Create</span>
                </Button>
              </CreateDatabase>
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
                <Link href={route('databases', { server: page.props.replicaOf.server_id })} className="text-foreground underline">
                  Open the primary
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <VitoTable tableData={page.props.databases} />
      </Container>
    </ServerLayout>
  );
}
