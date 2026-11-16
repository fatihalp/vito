import { useTranslate } from '@/hooks/use-translate';
import RuntimeProcesses from '@/components/runtime-processes';
import { Head, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { PaginatedData } from '@/types';
import ServerLayout from '@/layouts/server/layout';
import SiteBanners from '@/components/site-banners';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontalIcon, PlusIcon, RefreshCwIcon, RotateCwIcon } from 'lucide-react';
import Container from '@/components/container';
import { DataTable } from '@/components/data-table';
import { Worker } from '@/types/worker';
import { columns } from '@/pages/workers/components/columns';
import { Site } from '@/types/site';
import { useRealtime } from '@/hooks/use-socket-events';
import { useDialog } from '@/hooks/use-dialog';

export default function WorkerIndex() {
  const translateText = useTranslate();
  const page = usePage<{
    server: Server;
    workers: PaginatedData<Worker>;
    site?: Site;
    sites?: Array<{ id: number; domain: string }>;
  }>();
  const dialog = useDialog();

  const [workers] = useRealtime<Worker>(
    page.props.workers,
    'worker',
    page.props.site ? { site_id: page.props.site.id } : { server_id: page.props.server.id },
  );

  const scope = page.props.site ? { server: page.props.server.id, site: page.props.site.id } : { server: page.props.server.id };
  const scopeLabel = page.props.site ? `${page.props.site.domain}'s workers` : "this server's workers";

  return (
    <ServerLayout>
      <Head title={translateText("Workers - :value", { value: page.props.server.name })} />

      <Container>
        <HeaderContainer>
          <Heading
            title={translateText('Workers')}
            description={page.props.site ? `Here you can manage ${page.props.site.domain}'s workers` : translateText("Here you can manage server's workers")}
          />
          {page.props.server.services?.process_manager && <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MoreHorizontalIcon className="size-4" />
                  <span>{translateText('Actions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    dialog.confirm.open({
                      title: 'Resync workers',
                      description: translateText("Fetch the live status of :value from the process manager and update Pure. Continue?", { value: scopeLabel }),
                      confirmLabel: 'Resync',
                      method: 'post',
                      url: `/servers/${scope.server}/workers/resync${scope.site ? `/${scope.site}` : ''}`,
                    })
                  }
                >
                  <RefreshCwIcon />
                  {translateText("Resync")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    dialog.confirm.open({
                      title: 'Restart all workers',
                      description: translateText("Are you sure you want to restart :value?", { value: scopeLabel }),
                      confirmLabel: 'Restart All',
                      method: 'post',
                      url: `/servers/${scope.server}/workers/restart-all${scope.site ? `/${scope.site}` : ''}`,
                    })
                  }
                >
                  <RotateCwIcon />
                  {translateText("Restart All")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => dialog.workerForm.open({ serverId: page.props.server.id, site: page.props.site })}>
              <PlusIcon />
              <span className="hidden lg:block">{translateText('Create')}</span>
            </Button>
          </div>}
        </HeaderContainer>

        {page.props.site && <SiteBanners site={page.props.site} />}

        <RuntimeProcesses kind="worker" />

        <DataTable columns={columns(page.props.sites)} paginatedData={workers} />
      </Container>
    </ServerLayout>
  );
}
