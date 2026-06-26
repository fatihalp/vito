import { Head, useForm, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { PaginatedData } from '@/types';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { BookOpenIcon, LoaderCircleIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import { Worker } from '@/types/worker';
import { columns } from '@/pages/workers/components/columns';
import WorkerForm from '@/pages/workers/components/form';
import { Site } from '@/types/site';

export default function WorkerIndex() {
  const page = usePage<{
    server: Server;
    workers: PaginatedData<Worker>;
    site?: Site;
    sites?: Array<{ id: number; domain: string }>;
  }>();
  const syncForm = useForm();

  const syncWorkers = () => {
    syncForm.post(route('workers.sync', { server: page.props.server.id, site: page.props.site?.id }), {
      preserveScroll: true,
    });
  };

  return (
    <ServerLayout>
      <Head title={`Workers - ${page.props.server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title="Workers"
            description={page.props.site ? `Here you can manage ${page.props.site.domain}'s workers` : "Here you can manage server's workers"}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={syncWorkers} disabled={syncForm.processing}>
              {syncForm.processing ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
              <span className="hidden lg:block">Sync</span>
            </Button>
            <a href="https://vitodeploy.com/docs/servers/workers" target="_blank">
              <Button variant="outline">
                <BookOpenIcon />
                <span className="hidden lg:block">Docs</span>
              </Button>
            </a>
            <WorkerForm serverId={page.props.server.id} site={page.props.site}>
              <Button>
                <PlusIcon />
                <span className="hidden lg:block">Create</span>
              </Button>
            </WorkerForm>
          </div>
        </HeaderContainer>

        <DataTable columns={columns(page.props.sites)} paginatedData={page.props.workers} />
      </Container>
    </ServerLayout>
  );
}
