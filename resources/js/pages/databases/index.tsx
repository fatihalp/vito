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
  databaseSizes: {
    sizes: Record<string, number>;
    checked_at: string | null;
    failed: boolean;
    checking: boolean;
  };
  canRefreshDatabaseSizes: boolean;
  replicaOf?: { server_id: number; name: string | null } | null;
};

export default function Databases() {
  const page = usePage<Page>();
  const dialog = useDialog();
  const { advanced } = usePanelView();
  const sizeForm = useForm({});
  const { databaseSizes } = page.props;
  const checkingSizes = databaseSizes.checking || sizeForm.processing;

  const dbType = page.props.server.services['database'];
  const defaultCharset = dbType === 'postgresql' ? 'UTF8' : 'utf8mb4';
  const defaultCollation = dbType === 'postgresql' ? 'C.utf8' : 'utf8mb4_0900_ai_ci';
  const showSizes = advanced && dbType === 'postgresql';

  useEffect(() => {
    if (!databaseSizes.checking) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['databaseSizes'] });
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [databaseSizes.checking]);

  return (
    <ServerLayout>
      <Head title={`Databases - ${page.props.server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading
            title={
              page.props.server.counts?.databases !== undefined
                ? `Databases (${page.props.server.counts.databases})`
                : 'Databases'
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            {showSizes && page.props.canRefreshDatabaseSizes && (
              <Button
                variant="outline"
                disabled={checkingSizes}
                onClick={() => sizeForm.post(`/servers/${page.props.server.id}/database/refresh-sizes`, { preserveScroll: true })}
              >
                <RefreshCwIcon className={cn(checkingSizes && 'animate-spin')} />
                {checkingSizes ? 'Calculating sizes...' : 'Recalculate sizes'}
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

        <VitoTable
          fitContent
          tableData={{
            ...page.props.databases,
            columns: page.props.databases.columns.filter((column) => column.name !== 'size' || showSizes),
            data: page.props.databases.data.map((row) => {
              const size = databaseSizes.sizes[String(row.name)];
              return { ...row, size: size === undefined ? 'Not measured' : formatBytes(size) };
            }),
          }}
          toolbar={
            <>
              {showSizes && (
                <span className="text-xs text-muted-foreground" role="status">
                  {databaseSizes.failed
                    ? 'Size calculation failed. Previous results are preserved.'
                    : databaseSizes.checked_at
                      ? `Last measured: ${new Date(databaseSizes.checked_at).toLocaleString('en-US')}`
                      : 'Sizes have not been measured yet.'}
                </span>
              )}
              <div className="ml-auto">
                <PanelViewToggle label="Database view" />
              </div>
            </>
          }
        />
      </Container>
    </ServerLayout>
  );
}
