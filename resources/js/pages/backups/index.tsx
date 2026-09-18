import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SettingsLayout from '@/layouts/settings/layout';
import { BookOpenIcon, InfoIcon, PlusIcon } from 'lucide-react';
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
  attention: { id: number; server_id: number; title: string; problems: string[] }[];
  hasNotificationChannels: boolean;
  replicaOf?: { server_id: number; name: string | null; backup_id: number | null } | null;
};

export default function Backups() {
  const page = usePage<Page>();
  const dialog = useDialog();

  const Comp = page.props.server ? ServerLayout : SettingsLayout;

  return (
    <Comp>
      <Head title={`Backups${page.props.server ? ' - ' + page.props.server.name : ''}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Backups" />
          <div className="flex items-center gap-2">
            <Button onClick={() => dialog.backupCreate.open({ server: page.props.server })}>
              <PlusIcon />
              <span className="hidden lg:block">Create</span>
            </Button>
          </div>
        </HeaderContainer>

        {page.props.replicaOf && (
          <Alert>
            <InfoIcon />
            <AlertTitle>This server is a PostgreSQL replica of {page.props.replicaOf.name}</AlertTitle>
            <AlertDescription>
              <p>
                It holds the same data as {page.props.replicaOf.name}, so it isn't backed up separately. The cluster has one pgBackRest backup, set up on{' '}
                {page.props.replicaOf.name}. Vito runs it on the healthiest, most caught-up replica, which can be this server, straight to S3, and on the
                primary only when no replica qualifies. The Host column of each backup shows where it ran.
              </p>
              {page.props.replicaOf.backup_id && (
                <Link
                  href={route('backup-files', { server: page.props.replicaOf.server_id, backup: page.props.replicaOf.backup_id })}
                  className="text-foreground underline"
                >
                  View the cluster's backups
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <BackupHealthAlerts
          items={page.props.attention.map((backup) => ({ ...backup, href: route('backup-files', { server: backup.server_id, backup: backup.id }) }))}
          hasNotificationChannels={page.props.hasNotificationChannels}
        />

        <VitoTable
          tableData={page.props.backups}
          actions={(row: Row) => <BackupActions backup={asRow<{ resource: Backup }>(row, ['resource']).resource} />}
        />
      </Container>
    </Comp>
  );
}
