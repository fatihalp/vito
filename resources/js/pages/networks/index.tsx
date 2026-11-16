import { useTranslate } from '@/hooks/use-translate';
import { Head, Link, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { EyeIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import SettingsLayout from '@/layouts/settings/layout';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { useDialog } from '@/hooks/use-dialog';
import { NetworkServerOption } from '@/types/network';

export default function Networks() {
  const translateText = useTranslate();
  const page = usePage<{
    networks: InertiaTableData;
    servers: NetworkServerOption[];
  }>();
  const dialog = useDialog();

  return (
    <SettingsLayout>
      <Head title={translateText('Networks')} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('Networks')} />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() =>
                dialog.confirm.open({
                  title: 'Sync provider networks',
                  description:
                    "Query every cloud provider connection used by this project's servers and create, update or remove provider-managed networks to match. Servers Pure does not manage are ignored.",
                  confirmLabel: 'Sync',
                  method: 'post',
                  url: "/networks/sync",
                })
              }
            >
              <RefreshCwIcon />
              <span className="hidden lg:block">{translateText('Sync')}</span>
            </Button>
            <Button onClick={() => dialog.networkCreate.open({ servers: page.props.servers })}>
              <PlusIcon />
              <span className="hidden lg:block">{translateText('Create')}</span>
            </Button>
          </div>
        </HeaderContainer>

        <VitoTable
          tableData={page.props.networks}
          actions={(row: Row) => (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" asChild>
                <Link href={`/networks/${row.id}`} aria-label={translateText("View network")} prefetch>
                  <EyeIcon className="size-3.5" />
                  <span>{translateText('Manage')}</span>
                </Link>
              </Button>
            </div>
          )}
        />
      </Container>
    </SettingsLayout>
  );
}
