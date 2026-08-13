import { Head, Link, router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Layout from '@/layouts/app/layout';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { BookOpenIcon, CornerDownRightIcon, EyeIcon, PlusIcon, ServerIcon, TriangleAlertIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import CreateSite from '@/pages/sites/components/create-site';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { SharedData } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Page = {
  server?: Server;
  sites: InertiaTableData;
  siteScope?: string;
};

const siteCell = ({ row, value }: CellRenderProps) => (
  <div className="flex min-w-48 flex-col gap-1.5 py-1">
    <Link
      href={route('servers.show', { server: row.server_id as number })}
      className="text-foreground flex items-center gap-2 font-medium hover:underline"
    >
      <ServerIcon className="text-muted-foreground size-4" />
      {row.server_name as string}
    </Link>
    <Link
      href={route('application', { server: row.server_id as number, site: row.id as number })}
      className="text-muted-foreground hover:text-foreground flex items-center gap-2 pl-5 text-sm hover:underline"
      prefetch
    >
      <CornerDownRightIcon className="size-3.5" />
      {String(value)}
    </Link>
  </div>
);

export default function Sites() {
  const page = usePage<Page & SharedData>();

  const Comp = page.props.server ? ServerLayout : Layout;

  return (
    <Comp>
      <Head title={`Sites ${page.props.server ? ' - ' + page.props.server.name : ''}`} />
      <Container className="max-w-5xl">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <a href="https://vitodeploy.com/docs/sites/site-types" target="_blank">
              <Button variant="outline">
                <BookOpenIcon />
                <span className="hidden lg:block">Docs</span>
              </Button>
            </a>
            <CreateSite server={page.props.server}>
              <Button>
                <PlusIcon />
                <span className="hidden lg:block">Create site</span>
              </Button>
            </CreateSite>
          </div>
        </div>

        {!page.props.server && (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">Project</span>
            <Select
              value={page.props.siteScope ?? page.props.auth.currentProject?.id.toString()}
              onValueChange={(project) => {
                const url = new URL(window.location.href);
                url.searchParams.set('project', project);
                url.searchParams.delete('page');
                router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
              }}
            >
              <SelectTrigger className="w-64" aria-label="Filter sites by project">
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
        )}

        <VitoTable
          tableData={page.props.sites}
          cellRenderers={page.props.server ? undefined : { domain: siteCell }}
          actions={(row: Row) => {
            const warnings = (row.warnings as Array<{ key: string }>) ?? [];
            const count = warnings.length;
            return (
              <div className="flex items-center justify-end gap-2">
                {count > 0 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-warning/15 text-warning border-warning/40 flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1.5">
                          <TriangleAlertIcon className="h-4 w-4" />
                          <span className="text-xs font-semibold">{count}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {count} {count === 1 ? 'warning' : 'warnings'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Link href={route('application', { server: row.server_id, site: row.id })} prefetch>
                  <Button variant="outline" size="sm">
                    <EyeIcon />
                  </Button>
                </Link>
              </div>
            );
          }}
        />
      </Container>
    </Comp>
  );
}
