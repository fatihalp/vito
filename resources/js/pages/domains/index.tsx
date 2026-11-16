import { useTranslate } from '@/hooks/use-translate';
import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import AddDomain from '@/pages/domains/components/add-domain';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/domains/components/columns';
import { Domain } from '@/types/domain';
import { PaginatedData } from '@/types';
import { PlusIcon } from 'lucide-react';
import SettingsLayout from '@/layouts/settings/layout';

type Page = {
  domains: PaginatedData<Domain>;
};

export default function Domains() {
  const translateText = useTranslate();
  const page = usePage<Page>();

  return (
    <SettingsLayout>
      <Head title={translateText('Domains')} />
      <Container>
        <div className="flex items-start justify-between">
          <Heading title={translateText('Domains')} />
          <div className="flex items-center gap-2">
            <AddDomain>
              <Button>
                <PlusIcon />
                {translateText('Add Domain')}
              </Button>
            </AddDomain>
          </div>
        </div>
        <DataTable columns={columns} paginatedData={page.props.domains} searchable />
      </Container>
    </SettingsLayout>
  );
}
