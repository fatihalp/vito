import { Head, Link, router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import Layout from '@/layouts/app/layout';
import Container from '@/components/container';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import { Button } from '@/components/ui/button';
import { CornerDownRightIcon, PlusIcon, ServerIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import CreateSite from '@/pages/sites/components/create-site';
import { Badge } from '@/components/ui/badge';
import { WarningsPopover } from '@/components/banners';
import { getSiteWarningItems } from '@/components/site-banners';
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
  const dialog = useDialog();

  const Comp = page.props.server ? ServerLayout : Layout;

  return (
    <Comp>
      <Head title={`Sites ${page.props.server ? ' - ' + page.props.server.name : ''}`} />
      <Container className="max-w-none w-full">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
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
          cellRenderers={{
            ...(page.props.server ? {} : { domain: siteCell }),
            status: statusCell,
          }}
          actions={(row: Row) => {
            const site = asRow<{ id: number; server_id: number; domain: string }>(row, ['id', 'server_id', 'domain']);
            return (
              <div className="flex items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <TableActionTrigger />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={route('application', { server: site.server_id, site: site.id })}>
                        Manage
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={route('application.deployments.index', { server: site.server_id, site: site.id })}>
                        Deployments
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={route('application.environment', { server: site.server_id, site: site.id })}>
                        Env
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={route('site-settings', { server: site.server_id, site: site.id })}>
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        dialog.confirm.open({
                          title: `Delete site [${site.domain}]`,
                          description: `Are you sure you want to delete ${site.domain}? All files, configurations, and records associated with this site will be permanently deleted. This action cannot be undone.`,
                          variant: 'destructive',
                          confirmLabel: 'Delete',
                          method: 'delete',
                          url: route('sites.destroy', { server: site.server_id, site: site.id }),
                        })
                      }
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }}
        />
      </Container>
    </Comp>
  );
}
