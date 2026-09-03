import { useMemo } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import Layout from '@/layouts/app/layout';
import Container from '@/components/container';
import { asRow } from '@/lib/inertia-table';
import { Button } from '@/components/ui/button';
import { PlusIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import CreateSite from '@/pages/sites/components/create-site';
import { Badge } from '@/components/ui/badge';
import { WarningsPopover } from '@/components/banners';
import { getSiteWarningItems } from '@/components/site-banners';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { SharedData } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ServerOption = {
  id: number;
  name: string;
  project_id: number;
  project_name?: string | null;
};

type Page = {
  server?: Server;
  sites: InertiaTableData;
  siteScope?: string;
  serverScope?: string;
  groupBy?: 'none' | 'project' | 'server';
  servers?: ServerOption[];
};

const siteCell = ({ row, value }: CellRenderProps) => (
  <div className="flex min-w-48 flex-wrap items-baseline gap-x-2 gap-y-1 py-1">
    <Link
      href={route('application', { server: row.server_id as number, site: row.id as number })}
      className="text-foreground font-medium hover:underline"
      prefetch
    >
      {String(value)}
    </Link>
    <Link
      href={route('servers.show', { server: row.server_id as number })}
      className="text-muted-foreground text-sm hover:underline"
    >
      ({row.server_name as string})
    </Link>
  </div>
);

const statusCell = ({ row, value }: CellRenderProps) => {
  const site = row as unknown as Site;
  const warningItems = getSiteWarningItems(site);

  return (
    <div className="flex items-center gap-2">
      <Badge variant={(row.status_color as 'default') ?? 'default'}>
        {String(value)}
      </Badge>
      {warningItems.length > 0 && <WarningsPopover items={warningItems} />}
    </div>
  );
};

export default function Sites() {
  const page = usePage<Page & SharedData>();

  const Comp = page.props.server ? ServerLayout : Layout;

  const filteredServers = useMemo(() => {
    const all = page.props.servers ?? [];
    const currentProject = page.props.siteScope;
    if (!currentProject || currentProject === 'all') {
      return all;
    }
    return all.filter((s) => s.project_id.toString() === currentProject);
  }, [page.props.servers, page.props.siteScope]);

  return (
    <Comp>
      <Head title={`Sites ${page.props.server ? ' - ' + page.props.server.name : ''}`} />
      <Container className="w-full max-w-none py-3">
        <VitoTable
          tableData={page.props.sites}
          groupBy={page.props.groupBy}
          toolbar={
            <>
              {!page.props.server && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Project</span>
                    <Select
                      value={page.props.siteScope ?? page.props.auth.currentProject?.id.toString()}
                      onValueChange={(project) => {
                        const url = new URL(window.location.href);
                        url.searchParams.set('project', project);
                        if (project !== 'all') {
                          const currentServerId = url.searchParams.get('server');
                          if (currentServerId && currentServerId !== 'all') {
                            const match = (page.props.servers ?? []).find(
                              (s) => s.id.toString() === currentServerId && s.project_id.toString() === project,
                            );
                            if (!match) {
                              url.searchParams.delete('server');
                            }
                          }
                        }
                        url.searchParams.delete('page');
                        router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                      }}
                    >
                      <SelectTrigger className="w-40 sm:w-48" aria-label="Filter sites by project">
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {(page.props.auth.user.projects ?? []).map((project) => (
                          <SelectItem key={project.id} value={project.id.toString()}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Server</span>
                    <Select
                      value={page.props.serverScope ?? 'all'}
                      onValueChange={(server) => {
                        const url = new URL(window.location.href);
                        if (server === 'all') {
                          url.searchParams.delete('server');
                        } else {
                          url.searchParams.set('server', server);
                        }
                        url.searchParams.delete('page');
                        router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                      }}
                    >
                      <SelectTrigger className="w-40 sm:w-48" aria-label="Filter sites by server">
                        <SelectValue placeholder="All Servers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Servers</SelectItem>
                        {filteredServers.map((server) => (
                          <SelectItem key={server.id} value={server.id.toString()}>
                            {server.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">Group by</span>
                    <Select
                      value={page.props.groupBy ?? 'none'}
                      onValueChange={(groupBy) => {
                        const url = new URL(window.location.href);
                        if (groupBy === 'none') {
                          url.searchParams.delete('group_by');
                        } else {
                          url.searchParams.set('group_by', groupBy);
                        }
                        url.searchParams.delete('page');
                        router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                      }}
                    >
                      <SelectTrigger className="w-40 sm:w-48" aria-label="Group sites by">
                        <SelectValue placeholder="No grouping" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No grouping</SelectItem>
                        <SelectItem value="project">Group by Project</SelectItem>
                        <SelectItem value="server">Group by Server</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="ml-auto">
                <CreateSite server={page.props.server}>
                  <Button>
                    <PlusIcon />
                    Create site
                  </Button>
                </CreateSite>
              </div>
            </>
          }
          cellRenderers={{
            ...(page.props.server ? {} : { domain: siteCell }),
            status: statusCell,
          }}
          onRowClick={(row: Row) => {
            const site = asRow<{ id: number; server_id: number }>(row, ['id', 'server_id']);
            router.visit(route('application', { server: site.server_id, site: site.id }));
          }}
        />
      </Container>
    </Comp>
  );
}
