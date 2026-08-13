import { Head, usePage } from '@inertiajs/react';
import type { InertiaTableData } from '@forjedio/inertia-table-react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import ServerLayout from '@/layouts/server/layout';
import DeploymentsTable from '@/pages/application/deployments/table';
import { Server } from '@/types/server';
import { Site } from '@/types/site';

export default function DeploymentsIndex() {
  const page = usePage<{ server: Server; site: Site; deployments: InertiaTableData }>();

  return (
    <ServerLayout>
      <Head title={`Deployments - ${page.props.site.domain}`} />
      <Container className="max-w-7xl">
        <Heading title="Deployments" description={`Complete deployment history for ${page.props.site.domain}.`} />
        <DeploymentsTable deployments={page.props.deployments} />
      </Container>
    </ServerLayout>
  );
}
