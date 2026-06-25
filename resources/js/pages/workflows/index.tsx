import { Head, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { BookOpenIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/workflows/components/columns';
import { PaginatedData } from '@/types';
import { Workflow } from '@/types/workflow';
import Layout from '@/layouts/app/layout';
import CreateWorkflow from './components/create-workflow';
import ImportWorkflow from './components/import-workflow';
import { ServerProvider } from '@/types/server-provider';
import { SourceControl } from '@/types/source-control';

export default function Workflows() {
  const page = usePage<{
    workflows: PaginatedData<Workflow>;
    serverProviders: ServerProvider[];
    sourceControls: SourceControl[];
  }>();

  return (
    <Layout>
      <Head title={`Workflows`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Workflows" description="Workflows are chained scripts that will run in the defined order" />
          <div className="flex items-center gap-2">
            <a href="https://vitodeploy.com/docs/workflows" target="_blank">
              <Button variant="outline">
                <BookOpenIcon />
                <span className="hidden lg:block">Docs</span>
              </Button>
            </a>
            <CreateWorkflow>
              <Button>
                <PlusIcon />
                <span className="hidden lg:block">Create</span>
              </Button>
            </CreateWorkflow>
            <ImportWorkflow serverProviders={page.props.serverProviders} sourceControls={page.props.sourceControls}>
              <Button variant="outline">
                <UploadIcon />
                <span className="hidden lg:block">Import</span>
              </Button>
            </ImportWorkflow>
          </div>
        </HeaderContainer>

        <DataTable columns={columns} paginatedData={page.props.workflows} />
      </Container>
    </Layout>
  );
}
