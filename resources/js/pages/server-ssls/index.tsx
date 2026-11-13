import { useTranslate } from '@/hooks/use-translate';
import ServerLayout from '@/layouts/server/layout';
import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { PaginatedData } from '@/types';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/server-ssls/components/columns';
import { SSL } from '@/types/ssl';
import { Domain } from '@/types/domain';
import { useRealtime } from '@/hooks/use-socket-events';
import { Button } from '@/components/ui/button';
import DetectedCertificates from '@/pages/server-ssls/components/detected-certificates';
import CreateServerSsl from '@/pages/server-ssls/components/create-server-ssl';

export default function ServerSsls() {
  const translateText = useTranslate();
  const page = usePage<{
    server: Server;
    ssls: PaginatedData<SSL>;
    domains: Domain[];
  }>();

  const [ssls] = useRealtime<SSL>(page.props.ssls, 'ssl', { server_id: page.props.server.id });

  return (
    <ServerLayout>
      <Head title={translateText("SSL - :value", { value: page.props.server.name })} />

      <Container>
        <HeaderContainer>
          <Heading title={translateText('SSL certificates')} description={translateText("Certificates registered for this server and its applications. Review expiry dates and open the application's Domains page to manage a site certificate.")} />
          <div className="flex items-center gap-2">
            <CreateServerSsl server={page.props.server} domains={page.props.domains}>
              <Button>{translateText('Add')}</Button>
            </CreateServerSsl>
          </div>
        </HeaderContainer>

        <DataTable columns={columns} paginatedData={ssls} />
        <DetectedCertificates serverId={page.props.server.id} />
      </Container>
    </ServerLayout>
  );
}
