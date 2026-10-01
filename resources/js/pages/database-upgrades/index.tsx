import { Head, Link, usePage, usePoll } from '@inertiajs/react';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { Server } from '@/types/server';
import { DatabaseUpgrade } from '@/types/database-upgrade';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import ServerLayout from '@/layouts/server/layout';
import { useDialog } from '@/hooks/use-dialog';

type Page = {
  server: Server;
  upgrade: DatabaseUpgrade | null;
};

function gigabytes(bytes: number): string {
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

export default function DatabaseUpgrades() {
  const page = usePage<Page>();
  const dialog = useDialog();
  const { server, upgrade } = page.props;
  const isSource = !upgrade || upgrade.source_server_id === server.id;

  usePoll(upgrade?.active ? 15000 : 60000, { only: ['upgrade'] });

  const details: [string, React.ReactNode][] = upgrade
    ? [
        ['Old server', upgrade.source_server_name ?? '-'],
        ['New server', upgrade.target_server_name ?? '-'],
        ['PostgreSQL', `${upgrade.source_version ?? '?'} → ${upgrade.target_version}`],
        ['Databases', upgrade.databases.map((database) => database.name).join(', ') || '-'],
        ['Data to copy', gigabytes(upgrade.databases.reduce((total, database) => total + database.size, 0))],
        ['Private network', upgrade.network ? `${upgrade.network.name} (${upgrade.network.kind})` : 'being set up'],
        ['Behind by', upgrade.lag_bytes === null ? '-' : `${(upgrade.lag_bytes / 1048576).toFixed(1)} MB of WAL`],
        ['Started', new Date(upgrade.created_at).toLocaleString()],
      ]
    : [];

  return (
    <ServerLayout>
      <Head title={`Version upgrade - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title="Version upgrade"
            description="Move every database to a server running a newer PostgreSQL, with logical replication and a switch you control."
          />
          <div className="flex items-center gap-2">
            {upgrade && <Badge variant={upgrade.status_color}>{upgrade.status}</Badge>}
            {!upgrade && isSource && (
              <Button onClick={() => dialog.databaseUpgradeCreate.open({ server })}>
                <PlusIcon />
                <span className="hidden lg:block">Upgrade PostgreSQL</span>
              </Button>
            )}
            {upgrade && !isSource && (
              <Button variant="outline" asChild>
                <Link href={route('database-upgrades', { server: upgrade.source_server_id })}>Go to the old server</Link>
              </Button>
            )}
          </div>
        </HeaderContainer>

        {!upgrade && (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col gap-2 p-4 text-sm">
              <p>
                An upgrade creates a server with the PostgreSQL version you pick, copies the roles, schemas and rows of every database onto it, and then keeps
                it in sync. {server.name} keeps serving reads and writes the whole time.
              </p>
              <p>
                When the new server has caught up, you press <span className="text-foreground font-medium">Finish</span>: Vito stops new writes on{' '}
                {server.name}, waits for the last rows, copies the sequence values and stops the copy. Pointing your applications at the new server is then up
                to you.
              </p>
            </CardContent>
          </Card>
        )}

        {upgrade && (
          <>
            {upgrade.state === 'streaming' && (
              <Alert>
                <AlertTitle>{upgrade.target_server_name} holds every database and keeps up with the changes</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    Check the data on the new server, then finish the upgrade. Finishing stops writes on {upgrade.source_server_name}, disconnects its
                    applications, waits for the last rows, copies the sequence values and stops the copy. {upgrade.source_server_name} stays read-only
                    afterwards, so nothing writes to the old database by accident.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        dialog.confirm.open({
                          title: `Switch to ${upgrade.target_server_name}`,
                          description: `${upgrade.source_server_name} stops taking writes now and its applications are disconnected. Point them at ${upgrade.target_server_name} once this finishes.`,
                          confirmLabel: 'Finish the upgrade',
                          method: 'post',
                          url: route('database-upgrades.finish', { server: upgrade.source_server_id, databaseUpgrade: upgrade.id }),
                        })
                      }
                    >
                      <ArrowRightIcon />
                      Finish the upgrade
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {upgrade.message && (
              <Alert variant={upgrade.state === 'failed' ? 'destructive' : 'default'}>
                <AlertTitle>{upgrade.state === 'failed' ? 'The upgrade stopped' : 'Something needs attention'}</AlertTitle>
                <AlertDescription>{upgrade.message}</AlertDescription>
              </Alert>
            )}

            {upgrade.state === 'completed' && (
              <Alert>
                <AlertTitle>{upgrade.databases.length} databases now live on {upgrade.target_server_name}</AlertTitle>
                <AlertDescription>
                  Point your applications at {upgrade.target_server_name}. {upgrade.source_server_name} no longer takes writes; run{' '}
                  <span className="font-mono">ALTER SYSTEM RESET default_transaction_read_only</span> there if you ever need it back.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardContent className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-right">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {upgrade.active && (
              <Card>
                <CardContent className="flex flex-col gap-2 p-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span>{upgrade.step ?? 'Working…'}</span>
                    {upgrade.progress !== null && <span className="text-muted-foreground">{upgrade.progress}%</span>}
                  </div>
                  {upgrade.progress !== null && <Progress value={upgrade.progress} />}
                </CardContent>
              </Card>
            )}

            {upgrade.warnings.length > 0 && upgrade.active && (
              <Card>
                <CardContent className="flex flex-col gap-2 p-4 text-sm">
                  <p className="font-medium">What this copy does not move</p>
                  <ul className="text-muted-foreground list-disc pl-4">
                    {upgrade.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              {upgrade.target_server_id && (
                <Button variant="outline" asChild>
                  <Link href={route('servers.show', { server: upgrade.target_server_id })}>Open {upgrade.target_server_name}</Link>
                </Button>
              )}
              {!upgrade.busy && upgrade.state !== 'completed' && upgrade.state !== 'cancelled' && (
                <Button
                  variant="outline"
                  onClick={() =>
                    dialog.confirm.open({
                      title: 'Cancel the upgrade',
                      description: `Vito stops the copy, removes the publications, the replication user and the pg_hba rule from ${upgrade.source_server_name}, and lets it take writes again. ${upgrade.target_server_name ?? 'The new server'} is kept; delete it yourself when you no longer need it.`,
                      confirmLabel: 'Cancel the upgrade',
                      method: 'post',
                      url: route('database-upgrades.cancel', { server: upgrade.source_server_id, databaseUpgrade: upgrade.id }),
                    })
                  }
                >
                  Cancel the upgrade
                </Button>
              )}
              {!upgrade.active && !upgrade.busy && (
                <Button
                  variant="outline"
                  onClick={() =>
                    dialog.confirm.open({
                      title: 'Remove this upgrade',
                      description: 'This only removes the record from Vito. Neither server is changed.',
                      confirmLabel: 'Remove',
                      method: 'delete',
                      url: route('database-upgrades.destroy', { server: upgrade.source_server_id, databaseUpgrade: upgrade.id }),
                    })
                  }
                >
                  Remove
                </Button>
              )}
            </div>
          </>
        )}
      </Container>
    </ServerLayout>
  );
}
