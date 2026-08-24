import SettingsLayout from '@/layouts/settings/layout';
import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { VitoTable } from '@/components/vito-table';
import { SshKey } from '@/types/ssh-key';
import AddSshKey from '@/pages/ssh-keys/components/add-ssh-key';
import Delete from '@/pages/ssh-keys/components/delete';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlusIcon } from 'lucide-react';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { asRow } from '@/lib/inertia-table';

type Page = {
  sshKeys: InertiaTableData;
};

export default function SshKeys() {
  const page = usePage<Page>();

  return (
    <SettingsLayout>
      <Head title="SSH Keys" />
      <Container className="max-w-5xl">
        <div className="flex items-start justify-between">
          <Heading title="SSH Keys" />
          <div className="flex items-center gap-2">
            <AddSshKey>
              <Button>
                <PlusIcon />
                Add
              </Button>
            </AddSshKey>
          </div>
        </div>

        <VitoTable
          tableData={page.props.sshKeys}
          actions={(row: Row) => (
            <div className="flex items-center gap-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <TableActionTrigger />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <Delete sshKey={asRow<SshKey>(row, ['id', 'name'])} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        />
      </Container>
    </SettingsLayout>
  );
}
