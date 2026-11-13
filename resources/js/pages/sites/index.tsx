import { useTranslate } from '@/hooks/use-translate';
import { useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import Layout from '@/layouts/app/layout';
import Container from '@/components/container';
import { asRow } from '@/lib/inertia-table';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, PlusIcon } from 'lucide-react';
import { VitoTable } from '@/components/vito-table';
import { Badge } from '@/components/ui/badge';
import DateTime from '@/components/date-time';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WarningsPopover } from '@/components/banners';
import { getSiteWarningItems } from '@/components/site-banners';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePanelView } from '@/hooks/use-panel-view';
import PanelViewToggle from '@/components/panel-view-toggle';
import CommitsBehindCell from '@/pages/sites/components/commits-behind-cell';

type Page = {
  server?: Server;
  sites: InertiaTableData;
  groupBy?: 'none' | 'project' | 'server';
  gitStatus?: 'all' | 'up_to_date' | 'behind';
  gitStatusChecking?: number;
};

const siteCell = ({ row, value }: CellRenderProps) => (
  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
    <Link
      href={`/servers/${row.server_id as number}/sites/${row.id as number}`}
      className="text-foreground font-medium hover:underline"
      prefetch
    >
      {String(value)}
    </Link>
    <Link
      href={`/servers/${row.server_id as number}`}
      className="text-muted-foreground text-xs hover:underline"
    >
      ({row.server_name as string})
    </Link>
    <SiteWarnings row={row} />
  </div>
);

function SiteWarnings({ row }: { row: Row }) {
  const translateText = useTranslate();
  const warningItems = getSiteWarningItems(row as unknown as Site, false, translateText);

  return (
    <>
      {row.status && row.status !== 'ready' && (
        <Badge variant={(row.status_color as 'default') ?? 'default'}>{translateText(String(row.status))}</Badge>
      )}
      {warningItems.length > 0 && <WarningsPopover items={warningItems} />}
    </>
  );
}

function GitCell({ row, value }: CellRenderProps) {
  if (!value) {
    return null;
  }

  return <CommitsBehindCell serverId={row.server_id as number} siteId={row.id as number} />;
}

function RelativeDateCell({ value }: CellRenderProps) {
  const translateText = useTranslate();
  if (typeof value !== 'string' || !value) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap text-xs" aria-label={translateText("Show exact date")}>
          <DateTime date={value} relative />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto text-sm" align="end">
        <DateTime date={value} />
      </PopoverContent>
    </Popover>
  );
}

export default function Sites() {
  const translateText = useTranslate();
  const page = usePage<Page>();
  const { advanced } = usePanelView();
  const gitStatusChecking = page.props.gitStatusChecking ?? 0;

  useEffect(() => {
    if (gitStatusChecking === 0) {
      return;
    }
    const timeout = window.setTimeout(() => router.reload({ only: ['sites', 'gitStatusChecking'] }), 3000);

    return () => window.clearTimeout(timeout);
  }, [gitStatusChecking]);

  const Comp = page.props.server ? ServerLayout : Layout;

  return (
    <Comp>
      <Head title={translateText("Sites :value", { value: page.props.server ? ' - ' + page.props.server.name : '' })} />
      <Container className="py-3">
        <VitoTable
          fitContent
          toolbarClassName="[&_input]:h-8 [&_input]:min-w-36 [&_input]:max-w-56 [&_input]:text-sm"
          tableData={{ ...page.props.sites, columns: page.props.sites.columns.filter((column) => column.hidden || ['domain', 'server.project.name', 'created_at', ...(advanced ? ['branch', 'last_deployed_at'] : [])].includes(column.name)).map((column) => ({ ...column, fit: false })) }}
          columnWidths={{ 'server.project.name': '18%', branch: '13rem', last_deployed_at: '9rem', created_at: '9rem' }}
          rowClassName={() => '[&>td]:py-2'}
          groupBy={page.props.groupBy}
          toolbar={
            <>
              {!page.props.server && (
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
                  <SelectTrigger className="h-8 w-36 text-sm" aria-label={translateText("Group sites by")}>
                    <SelectValue placeholder={translateText("No grouping")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{translateText("No grouping")}</SelectItem>
                    <SelectItem value="project">{translateText("Group by Project")}</SelectItem>
                    <SelectItem value="server">{translateText("Group by Server")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {advanced && (
                <Select
                  value={page.props.gitStatus ?? 'all'}
                  onValueChange={(gitStatus) => {
                    const url = new URL(window.location.href);
                    if (gitStatus === 'all') {
                      url.searchParams.delete('git_status');
                    } else {
                      url.searchParams.set('git_status', gitStatus);
                    }
                    url.searchParams.delete('page');
                    router.get(url.toString(), {}, { preserveScroll: true, preserveState: true, replace: true });
                  }}
                >
                  <SelectTrigger className="h-8 w-36 text-sm" aria-label={translateText("Filter sites by Git status")}>
                    <SelectValue placeholder={translateText("All Git statuses")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{translateText("All Git statuses")}</SelectItem>
                    <SelectItem value="up_to_date">{translateText("Up to date")}</SelectItem>
                    <SelectItem value="behind">{translateText("Behind")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {advanced && gitStatusChecking > 0 && (
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  {translateText(gitStatusChecking === 1 ? 'Checking :count site' : 'Checking :count sites', { count: gitStatusChecking })}
                </span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <PanelViewToggle label="Site view" />
                {!page.props.server?.is_self && (
                    <Button asChild>
                      <Link
                        href={
                          page.props.server
                            ? `/servers/${page.props.server.id}/sites/create`
                            : "/sites/create"
                        }
                      >
                        <PlusIcon />
                        {translateText('Create site')}
                      </Link>
                    </Button>
                )}
              </div>
            </>
          }
          cellRenderers={{
            domain: siteCell,
            'server.project.name': ({ value }) => <span className="text-muted-foreground text-xs">{String(value ?? '')}</span>,
            branch: GitCell,
            last_deployed_at: RelativeDateCell,
            created_at: RelativeDateCell,
          }}
          onRowClick={(row: Row) => {
            const site = asRow<{ id: number; server_id: number }>(row, ['id', 'server_id']);
            router.visit(`/servers/${site.server_id}/sites/${site.id}`);
          }}
        />
      </Container>
    </Comp>
  );
}
