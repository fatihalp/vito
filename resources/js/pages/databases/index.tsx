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
  registeredDatabases: Array<{ name: string; container: string; applications: Array<{ domain: string; browse_url: string; resources_url: string; can_browse: boolean }> }>;
  replicaOf?: { server_id: number; name: string | null } | null;
};

export default function Databases() {
  const page = usePage<Page>();
  const dialog = useDialog();

  const dbType = page.props.server.services['database'];
  const registeredDatabases = page.props.registeredDatabases ?? [];
  const databaseCount = (page.props.server.counts?.databases ?? 0) + registeredDatabases.length;
  const defaultCharset = dbType === 'postgresql' ? 'UTF8' : 'utf8mb4';
  const defaultCollation = dbType === 'postgresql' ? 'C.utf8' : 'utf8mb4_0900_ai_ci';

  return (
    <ServerLayout>
      <Head title={`Databases - ${page.props.server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading
            title={`Databases (${databaseCount})`}
          />
          {dbType && <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                dialog.confirm.open({
                  title: 'Sync databases',
                  description:
                    'This action will connect to your server and perform a two-way synchronization of databases. Pure will fetch any databases created manually on the server, and verify the existence of databases managed by Pure. If a database tracked by Pure no longer exists on the server, it will be removed from Pure. Are you sure you want to proceed?',
                  confirmLabel: 'Sync databases',
                  url: `/servers/${page.props.server.id}/database/sync`,
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
          </div>}
        </HeaderContainer>

        {page.props.replicaOf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>This server is a PostgreSQL replica of {page.props.replicaOf.name}</AlertTitle>
            <AlertDescription>
              <p>
                Everything here is a copy of {page.props.replicaOf.name} and is read-only, so create and delete on the primary. Pure imports the list when
                the replica is built; use Sync to refresh it.
              </p>
              {page.props.replicaOf.server_id && (
                <Link href={`/servers/${page.props.replicaOf.server_id}/database`} className="text-foreground underline">
                  Open the primary
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        {registeredDatabases.length > 0 && <section className="space-y-3" aria-label="Registered container databases">
          <Heading title="Existing container databases" description="These connections preserve the running database. Table browsing is read only; server-level Sync and Create do not change container databases." />
          <div className="grid gap-3 lg:grid-cols-2">{registeredDatabases.map((database) => <article key={`${database.container}|${database.name}`} className="space-y-3 rounded-lg border p-4">
            <div><h2 className="font-semibold break-all">{database.name}</h2><p className="text-muted-foreground break-all text-sm">Docker · PostgreSQL · {database.container}</p></div>
            {database.applications.map((application) => <div key={application.resources_url} className="flex flex-wrap items-center justify-between gap-2">
              <Link className="text-sm underline" href={application.resources_url}>{application.domain}</Link>
              {application.can_browse && <Button variant="outline" size="sm" asChild><Link href={application.browse_url}>Browse tables</Link></Button>}
            </div>)}
          </article>)}</div>
        </section>}
        {dbType ? <VitoTable tableData={page.props.databases} /> : registeredDatabases.length === 0 && <Alert><InfoIcon /><AlertTitle>No database connections registered</AlertTitle><AlertDescription>Link an existing application database from its Resources page. This screen lists registered connections and does not automatically discover or install database services.</AlertDescription></Alert>}
      </Container>
    </ServerLayout>
  );
}
