import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import SettingsLayout from '@/layouts/settings/layout';
import { BookOpenIcon, PlusIcon } from 'lucide-react';
import { Backup } from '@/types/backup';
import { VitoTable } from '@/components/vito-table';
import BackupActions from '@/pages/backups/components/backup-actions';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';

type Page = {
  server?: Server;
  backups: InertiaTableData;
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

        <VitoTable
          tableData={page.props.backups}
          actions={(row: Row) => <BackupActions backup={asRow<{ resource: Backup }>(row, ['resource']).resource} />}
        />
      </Container>
    </Comp>
  );
}
