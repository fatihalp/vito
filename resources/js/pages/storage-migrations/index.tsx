import { Head, usePage, usePoll } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import SettingsLayout from '@/layouts/settings/layout';
import { ArrowLeftRightIcon } from 'lucide-react';
import { StorageMigration } from '@/types/storage-migration';
import { VitoTable } from '@/components/vito-table';
import StorageMigrationActions from '@/pages/storage-migrations/components/storage-migration-actions';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';

type Page = {
  storageMigrations: InertiaTableData;
};

export default function StorageMigrations() {
  const page = usePage<Page>();
  const dialog = useDialog();

  usePoll(5000, { only: ['storageMigrations'] });

  return (
    <SettingsLayout>
      <Head title="Storage Migrations" />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Storage Migrations" description="Move backup objects between storage providers" />
          <div className="flex items-center gap-2">
            <Button onClick={() => dialog.storageMigrationCreate.open({})}>
              <ArrowLeftRightIcon />
              <span className="hidden lg:block">Migrate storage</span>
            </Button>
          </div>
        </HeaderContainer>

        <VitoTable
          tableData={page.props.storageMigrations}
          actions={(row: Row) => (
            <StorageMigrationActions storageMigration={asRow<{ resource: StorageMigration }>(row, ['resource']).resource} />
          )}
        />
      </Container>
    </SettingsLayout>
  );
}
