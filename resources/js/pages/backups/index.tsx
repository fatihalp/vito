import BackupMonitors from '@/pages/backups/components/backup-monitors';
import type { BackupMonitor, BackupMonitorServer } from '@/types/backup-monitor';
import { useTranslate } from '@/hooks/use-translate';
import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SettingsLayout from '@/layouts/settings/layout';
import { InfoIcon, PlusIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Backup } from '@/types/backup';
import { VitoTable } from '@/components/vito-table';
import BackupActions from '@/pages/backups/components/backup-actions';
import BackupHealthAlerts from '@/pages/backups/components/backup-health-alerts';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';

type Page = {
  server?: Server;
  backups: InertiaTableData;
  backupMonitors?: BackupMonitor[];
  monitorServers?: BackupMonitorServer[];
  attention: { id: number; server_id: number; title: string; problems: string[] }[];
  hasNotificationChannels: boolean;
  replicaOf?: { server_id: number; name: string | null; backup_id: number | null } | null;
};

export default function Backups() {
  const translateText = useTranslate();
  const page = usePage<Page>();
  const dialog = useDialog();

  const Comp = page.props.server ? ServerLayout : SettingsLayout;

  return (
    <Comp>
      <Head title={translateText("Backups:value", { value: page.props.server ? ' - ' + page.props.server.name : '' })} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('Backups')} />
          <div className="flex flex-wrap items-center gap-2">
            {!!page.props.monitorServers?.length && <Button variant="outline" onClick={() => dialog.backupMonitorCreate.open({ servers: page.props.monitorServers ?? [], serverId: page.props.server?.id })}>{translateText('Monitor existing backup')}</Button>}
            <Button onClick={() => dialog.backupCreate.open({ server: page.props.server })}>
              <PlusIcon />
              <span className="hidden lg:block">{translateText('Create')}</span>
            </Button>
          </div>
        </HeaderContainer>

        {page.props.replicaOf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>{translateText('This server is a PostgreSQL replica of')} {page.props.replicaOf.name}</AlertTitle>
            <AlertDescription>
              <p>
                {translateText("It holds the same data as")} {page.props.replicaOf.name}{translateText(", so it isn't backed up separately. The cluster has one pgBackRest backup, set up on")}{' '}
                {page.props.replicaOf.name}{translateText(". Pure runs it on the healthiest, most caught-up replica, which can be this server, straight to S3, and on the primary only when no replica qualifies. The Host column of each backup shows where it ran.")}
              </p>
              {page.props.replicaOf.backup_id && (
                <Link
                  href={`/servers/${page.props.replicaOf.server_id}/backups/${page.props.replicaOf.backup_id}/files`}
                  className="text-foreground underline"
                >
                  {translateText("View the cluster's backups")}
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <BackupHealthAlerts
          items={page.props.attention.map((backup) => ({ ...backup, href: `/servers/${backup.server_id}/backups/${backup.id}/files` }))}
          hasNotificationChannels={page.props.hasNotificationChannels}
        />

        <BackupMonitors monitors={page.props.backupMonitors ?? []} />

        {!!page.props.backupMonitors?.length && <h3 className="text-lg font-semibold">{translateText('Native backup jobs')}</h3>}
        <VitoTable
          tableData={page.props.backups}
          actions={(row: Row) => <BackupActions backup={asRow<{ resource: Backup }>(row, ['resource']).resource} />}
        />
      </Container>
    </Comp>
  );
}
