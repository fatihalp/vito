import { Head, usePage } from '@inertiajs/react';
import { PaginatedData } from '@/types';
import Layout from '@/layouts/app/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { PlusIcon, SparklesIcon, TerminalIcon } from 'lucide-react';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import { Script } from '@/types/script';
import { columns } from '@/pages/scripts/components/columns';
import { useDialog } from '@/hooks/use-dialog';

export default function Scripts() {
  const page = usePage<{
    scripts: PaginatedData<Script>;
  }>();
  const dialog = useDialog();

  return (
    <Layout>
      <Head title="Scripts" />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Scripts" description="Execute bash scripts across your servers and sites." />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => dialog.scriptTemplates.open({})}>
              <SparklesIcon className="text-primary size-4" />
              <span>From Template</span>
            </Button>
            <Button onClick={() => dialog.scriptForm.open({})}>
              <PlusIcon className="size-4" />
              <span>Create Script</span>
            </Button>
          </div>
        </HeaderContainer>

        {page.props.scripts.data.length === 0 && (
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-card flex flex-col justify-between rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-md">
              <div className="space-y-2">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                  <SparklesIcon className="size-5" />
                </div>
                <h4 className="text-sm font-semibold">Script Templates</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Ready-to-use templates for common server tasks.
                </p>
              </div>
              <div className="pt-4">
                <Button variant="outline" size="sm" onClick={() => dialog.scriptTemplates.open({})}>
                  <SparklesIcon className="mr-1.5 size-3.5" />
                  Browse Templates
                </Button>
              </div>
            </div>

            <div className="bg-card flex flex-col justify-between rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-md">
              <div className="space-y-2">
                <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
                  <TerminalIcon className="size-5" />
                </div>
                <h4 className="text-sm font-semibold">Custom Script</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Create a bash script from scratch with variable support.
                </p>
              </div>
              <div className="pt-4">
                <Button size="sm" onClick={() => dialog.scriptForm.open({})}>
                  <PlusIcon className="mr-1.5 size-3.5" />
                  New Script
                </Button>
              </div>
            </div>
          </div>
        )}

        <DataTable columns={columns} paginatedData={page.props.scripts} />
      </Container>
    </Layout>
  );
}
