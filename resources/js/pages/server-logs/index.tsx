import { useTranslate } from '@/hooks/use-translate';
import { Head, usePage } from '@inertiajs/react';
import { PaginatedData } from '@/types';
import { ServerLog } from '@/types/server-log';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/server-logs/components/columns';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import LogForm from '@/pages/server-logs/components/form';
import { useRealtime } from '@/hooks/use-socket-events';

export default function ServerLogs() {
  const translateText = useTranslate();
  const page = usePage<{
    title: string;
    server: Server;
    logs: PaginatedData<ServerLog>;
    remote?: boolean;
  }>();

  const [logs] = useRealtime<ServerLog>(page.props.logs, 'server-log', {
    server_id: page.props.server.id,
    is_remote: !!page.props.remote,
  });

  return (
    <ServerLayout>
      <Head title={`${page.props.title} - ${page.props.server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading
            title={page.props.title}
            description={page.props.remote ? translateText("View custom log files from this server.") : translateText("View operation events and command output recorded by Pure.")}
          />
          <div className="flex items-center gap-2">
            {page.props.remote && (
              <LogForm>
                <Button>
                  <PlusIcon />
                  <span className="hidden lg:block">{translateText('Create')}</span>
                </Button>
              </LogForm>
            )}
          </div>
        </HeaderContainer>

        <DataTable columns={columns} paginatedData={logs} searchable sortable />
      </Container>
    </ServerLayout>
  );
}
