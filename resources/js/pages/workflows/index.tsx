import { Head, router, usePage } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { DownloadIcon, MoreVerticalIcon, PlusIcon, SparklesIcon, UploadIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import { Workflow } from '@/types/workflow';
import Layout from '@/layouts/app/layout';
import CreateWorkflow from './components/create-workflow';
import Run from '@/pages/workflows/components/run';
import DeleteWorkflow from '@/pages/workflows/components/delete-workflow';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { asRow } from '@/lib/inertia-table';
import { useDialog } from '@/hooks/use-dialog';

export default function Workflows() {
  const page = usePage<{
    workflows: InertiaTableData;
  }>();
  const dialog = useDialog();

  return (
    <Layout>
      <Head title={`Workflows`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Workflows" description="Workflows are chained scripts that will run in the defined order" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => dialog.workflowTemplates.open({})}>
              <SparklesIcon className="size-4" />
              <span className="hidden lg:block">Templates</span>
            </Button>
            <Button variant="outline" onClick={() => dialog.workflowImport.open({})}>
              <UploadIcon className="size-4" />
              <span className="hidden lg:block">Import</span>
            </Button>
            <CreateWorkflow>
              <Button>
                <PlusIcon className="size-4" />
                <span className="hidden lg:block">Create</span>
              </Button>
            </CreateWorkflow>
          </div>
        </HeaderContainer>

        <VitoTable
          tableData={page.props.workflows}
          actions={(row: Row) => {
            const workflow = asRow<Workflow>(row, ['id', 'name']);
            return (
              <div className="flex items-center justify-end">
                <DropdownMenu modal>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Run workflow={workflow}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Run</DropdownMenuItem>
                    </Run>
                    <DropdownMenuItem onSelect={() => router.visit(route('workflow-runs', { workflow: workflow.id }))}>History</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.visit(route('workflows.show', { workflow: workflow.id }))}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => (window.location.href = route('workflows.export', { workflow: workflow.id }))}>
                      <DownloadIcon />
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DeleteWorkflow workflow={workflow}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DeleteWorkflow>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }}
        />
      </Container>
    </Layout>
  );
}
