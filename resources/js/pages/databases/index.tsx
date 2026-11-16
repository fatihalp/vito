import { useTranslate } from '@/hooks/use-translate';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import CreateDatabase from '@/pages/databases/components/create-database';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import { VitoTable } from '@/components/vito-table';
import { InfoIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { InertiaTableData } from '@forjedio/inertia-table-react';
import { useDialog } from '@/hooks/use-dialog';
import { usePanelView } from '@/hooks/use-panel-view';
import PanelViewToggle from '@/components/panel-view-toggle';
import { cn, formatBytes } from '@/lib/utils';

type Page = {
  server: Server;
  databases: InertiaTableData;
  registeredDatabases: Array<{ name: string; container: string; applications: Array<{ domain: string; browse_url: string; resources_url: string; can_browse: boolean }> }>;
  databaseSizes: {
    sizes: Record<string, number>;
    checked_at: string | null;
    failed: boolean;
    checking: boolean;
    running: boolean;
  };
  canRefreshDatabaseSizes: boolean;
  replicaOf?: { server_id: number; name: string | null } | null;
};

export default function Databases() {
  const translateText = useTranslate();
  const page = usePage<Page>();
  const dialog = useDialog();
  const { advanced } = usePanelView();
  const sizeForm = useForm({});
  const { databaseSizes } = page.props;
  const checkingSizes = databaseSizes.checking || sizeForm.processing;

  const dbType = page.props.server.services['database'];
  const registeredDatabases = page.props.registeredDatabases ?? [];
  const databaseCount = (page.props.server.counts?.databases ?? 0) + registeredDatabases.length;
  const defaultCharset = dbType === 'postgresql' ? 'UTF8' : 'utf8mb4';
  const defaultCollation = dbType === 'postgresql' ? 'C.utf8' : 'utf8mb4_0900_ai_ci';
  const showSizes = advanced && dbType === 'postgresql';

  useEffect(() => {
    if (!databaseSizes.checking) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['databaseSizes'] });
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [databaseSizes.checking]);

  return (
    <ServerLayout>
      <Head title={translateText("Databases - :value", { value: page.props.server.name })} />

      <Container>
        <HeaderContainer>
          <Heading
            title={translateText("Databases (:value)", { value: databaseCount })}
          />
          {dbType && <div className="flex flex-wrap items-center gap-2">
            {showSizes && page.props.canRefreshDatabaseSizes && (
              <Button
                variant="outline"
                disabled={checkingSizes}
                onClick={() => sizeForm.post(`/servers/${page.props.server.id}/database/refresh-sizes`, { preserveScroll: true })}
              >
                <RefreshCwIcon className={cn(checkingSizes && 'animate-spin')} />
                {translateText(checkingSizes ? (databaseSizes.running ? 'Estimating sizes...' : 'Waiting in queue...') : 'Refresh estimates')}
              </Button>
            )}
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
              {translateText('Sync')}
            </Button>
            {!page.props.replicaOf && (
              <CreateDatabase server={page.props.server.id} defaultCharset={defaultCharset} defaultCollation={defaultCollation}>
                <Button>
                  <PlusIcon />
                  <span className="hidden lg:block">{translateText('Create')}</span>
                </Button>
              </CreateDatabase>
            )}
          </div>}
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
                <Link href={`/servers/${page.props.replicaOf.server_id}/database`} className="text-foreground underline">
                  {translateText("Open the primary")}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        {registeredDatabases.length > 0 && <section className="space-y-3" aria-label={translateText("Registered container databases")}>
          <Heading title={translateText("Existing container databases")} description={translateText("These connections preserve the running database. Table browsing is read only; server-level Sync and Create do not change container databases.")} />
          <div className="grid gap-3 lg:grid-cols-2">{registeredDatabases.map((database) => <article key={`${database.container}|${database.name}`} className="space-y-3 rounded-lg border p-4">
            <div><h2 className="font-semibold break-all">{database.name}</h2><p className="text-muted-foreground break-all text-sm">Docker · PostgreSQL · {database.container}</p></div>
            {database.applications.map((application) => <div key={application.resources_url} className="flex flex-wrap items-center justify-between gap-2">
              <Link className="text-sm underline" href={application.resources_url}>{application.domain}</Link>
              {application.can_browse && <Button variant="outline" size="sm" asChild><Link href={application.browse_url}>{translateText("Browse tables")}</Link></Button>}
            </div>)}
          </article>)}</div>
        </section>}
        {dbType ? <VitoTable
          fitContent
          tableData={{
            ...page.props.databases,
            columns: page.props.databases.columns.filter((column) => column.name !== 'size' || showSizes),
            data: page.props.databases.data.map((row) => {
              const size = databaseSizes.sizes[String(row.name)];
              return { ...row, size: size === undefined ? translateText('Not measured') : `~${formatBytes(size)}` };
            }),
          }}
          toolbar={
            <>
              {showSizes && (
                <span className="text-xs text-muted-foreground" role="status" title={translateText('Approximate sizes from PostgreSQL statistics, last updated by ANALYZE or VACUUM. Recent changes may not be reflected.')}>
                  {databaseSizes.failed
                    ? translateText('Size calculation failed. Previous results are preserved.')
                    : databaseSizes.checked_at
                      ? translateText('Last measured: :date', { date: new Date(databaseSizes.checked_at).toLocaleString() })
                      : translateText('Sizes have not been measured yet.')}
                </span>
              )}
              <div className="ml-auto">
                <PanelViewToggle label={translateText('Database view')} />
              </div>
            </>
          }
        /> : registeredDatabases.length === 0 && <Alert><InfoIcon /><AlertTitle>{translateText("No database connections registered")}</AlertTitle><AlertDescription>{translateText("Link an existing application database from its Resources page. This screen lists registered connections and does not automatically discover or install database services.")}</AlertDescription></Alert>}
      </Container>
    </ServerLayout>
  );
}
