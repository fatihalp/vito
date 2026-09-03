import { Fragment, ReactNode, useEffect, useMemo } from 'react';
import { useTable, type InertiaTableData, type InertiaTableProps, type CellRenderProps } from '@forjedio/inertia-table-react';
import { Link, router } from '@inertiajs/react';
import { SOCKET_EVENT, type SocketEventData } from '@/stores/socket-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FolderIcon,
  LoaderCircleIcon,
  ServerIcon,
} from 'lucide-react';
import { orderTableColumns } from '@/lib/table-columns';

function getPaginationPages(currentPage: number, lastPage?: number): (number | 'ellipsis')[] {
  if (!lastPage || lastPage <= 1) {
    return [currentPage || 1];
  }

  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', lastPage];
  }

  if (currentPage >= lastPage - 3) {
    return [1, 'ellipsis', lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', lastPage];
}

interface VitoTableProps extends Omit<InertiaTableProps, 'tableData'> {
  tableData: InertiaTableData;
  children?: ReactNode;
  showPagination?: boolean;
  toolbar?: ReactNode;
  groupBy?: 'project' | 'server' | 'none' | string | null;
}

function getRealtimePrefix(tableData: InertiaTableData): string | undefined {
  const value = tableData.tableSettings?.realtime;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveHref(display: CellRenderProps['displays'][number], row: CellRenderProps['row']): string | null {
  if (display.type !== 'link') return null;
  if (display.href_key) return row[display.href_key] as string;
  if (!display.route || !display.params) return null;

  const params: Record<string, string | number> = {};
  for (const [key, val] of Object.entries(display.params)) {
    params[key] = val.startsWith(':') ? (row[val.slice(1)] as string | number) : val;
  }
  return route(display.route, params);
}

function vitoCellRenderer({ row, value, displays, defaultRender }: CellRenderProps & { defaultRender: () => ReactNode }): ReactNode {
  if (displays.length === 1 && displays[0].type === 'badge') {
    if (value == null || value === '') {
      return <span className="text-muted-foreground">-</span>;
    }
    const display = displays[0];
    const color = display.color_field ? (row[display.color_field] as string) : display.variant;
    return <Badge variant={(color ?? 'default') as 'default'}>{String(value)}</Badge>;
  }

  if (displays.some((d) => d.type === 'link')) {
    const linkDisplay = displays.find((d) => d.type === 'link')!;
    const href = resolveHref(linkDisplay, row);
    if (href && value != null) {
      return (
        <Link href={href} prefetch={'prefetch' in linkDisplay && linkDisplay.prefetch ? 'hover' : undefined}>
          {String(value)}
        </Link>
      );
    }
  }

  return defaultRender();
}

export function VitoTable({ tableData, children, modal, isFetching, showPagination = true, toolbar, groupBy, ...props }: VitoTableProps) {
  const orderedTableData = useMemo(() => {
    let cols = orderTableColumns(tableData.columns, (column) => column.name);
    if (groupBy === 'project') {
      cols = cols.filter((c) => c.name !== 'server.project.name' && c.name !== 'project.name');
    }
    return { ...tableData, columns: cols };
  }, [tableData, groupBy]);
  const { columns, searchTerm, onSearch, onSort, getSortState, onPageChange, isProcessing } = useTable({
    tableData: orderedTableData,
    modal,
    isFetching,
    renderCell: vitoCellRenderer as InertiaTableProps['renderCell'],
    ...props,
  });

  const currentPage = tableData?.meta?.current_page || 1;
  const lastPage = tableData?.meta?.last_page;
  const pageNumbers = useMemo(() => getPaginationPages(currentPage, lastPage), [currentPage, lastPage]);

  const currentPerPage = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const perPageParam = orderedTableData.identifier ? `${orderedTableData.identifier}PerPage` : 'per_page';
      const fromUrl = params.get(perPageParam) || params.get('per_page') || params.get('perPage');
      if (fromUrl && ['10', '25', '50'].includes(fromUrl)) {
        return fromUrl;
      }
    }
    if (tableData?.meta?.per_page) {
      return String(tableData.meta.per_page);
    }
    return '25';
  }, [orderedTableData.identifier, tableData?.meta?.per_page]);

  const handlePerPageChange = (newPerPage: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const perPageParam = orderedTableData.identifier ? `${orderedTableData.identifier}PerPage` : 'per_page';
    const pageParam = orderedTableData.identifier ? `${orderedTableData.identifier}Page` : 'page';

    url.searchParams.set(perPageParam, newPerPage);
    url.searchParams.set('per_page', newPerPage);
    url.searchParams.set(pageParam, '1');

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  const realtimePrefix = getRealtimePrefix(orderedTableData);
  useEffect(() => {
    if (!realtimePrefix) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const handler = (e: Event) => {
      const type = (e as CustomEvent<SocketEventData>).detail?.type;
      if (type?.startsWith(`${realtimePrefix}.`)) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => router.reload(), 900);
      }
    };
    window.addEventListener(SOCKET_EVENT, handler);
    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener(SOCKET_EVENT, handler);
    };
  }, [realtimePrefix]);

  const processing = isProcessing || isFetching;

  return (
    <div>
      {(orderedTableData.searchable || toolbar) && (
        <div className={cn('mb-4 flex items-center gap-2', toolbar && 'mb-3 flex-wrap')}>
          {orderedTableData.searchable && (
            <>
              <Input
                placeholder="Search..."
                aria-label="Search table"
                className={cn('max-w-sm', toolbar && 'min-w-48 flex-1')}
                value={searchTerm}
                onChange={(e) => onSearch(e.target.value)}
              />
              {processing && <LoaderCircleIcon className="text-muted-foreground shrink-0 animate-spin" />}
            </>
          )}
          {toolbar}
        </div>
      )}

      <div className={cn('relative overflow-hidden rounded-md border shadow-xs', modal && 'border-none shadow-none')}>
        <Table>
          <TableHeader>
            <TableRow>
              {orderedTableData.columns
                .filter((c) => !c.hidden)
                .map((colDef) => {
                  const sortState = getSortState(colDef.sort_key);

                  return (
                    <TableHead key={colDef.name} className={colDef.fit ? 'w-0' : undefined}>
                      {colDef.sortable ? (
                        <button type="button" className="flex cursor-pointer items-center gap-2" onClick={() => onSort(colDef.sort_key)}>
                          {colDef.header}
                          {sortState.active ? (
                            sortState.direction === 'asc' ? (
                              <ChevronUpIcon className="text-muted-foreground inline-block h-4 w-4" />
                            ) : (
                              <ChevronDownIcon className="text-muted-foreground inline-block h-4 w-4" />
                            )
                          ) : (
                            <ChevronsUpDownIcon className="text-muted-foreground inline-block h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        colDef.header
                      )}
                    </TableHead>
                  );
                })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderedTableData.data.length > 0 ? (
              orderedTableData.data.map((row, rowIndex) => {
                let groupHeader: ReactNode = null;
                if (groupBy && groupBy !== 'none') {
                  const currentKey =
                    groupBy === 'project'
                      ? String(row.project_name || row['server.project.name'] || row['project.name'] || 'Unknown Project')
                      : String(row.server_name || 'Unknown Server');

                  const prevRow = rowIndex > 0 ? orderedTableData.data[rowIndex - 1] : null;
                  const prevKey = prevRow
                    ? (groupBy === 'project'
                        ? String(prevRow.project_name || prevRow['server.project.name'] || prevRow['project.name'] || 'Unknown Project')
                        : String(prevRow.server_name || 'Unknown Server'))
                    : null;

                  if (currentKey !== prevKey) {
                    const groupCount = orderedTableData.data.filter((r) => {
                      const k =
                        groupBy === 'project'
                          ? String(r.project_name || r['server.project.name'] || r['project.name'] || 'Unknown Project')
                          : String(r.server_name || 'Unknown Server');
                      return k === currentKey;
                    }).length;

                    const itemLabel = 'ip' in row
                      ? (groupCount === 1 ? 'server' : 'servers')
                      : (groupCount === 1 ? 'site' : 'sites');

                    groupHeader = (
                      <TableRow
                        key={`group-header-${currentKey}-${rowIndex}`}
                        className="bg-muted/40 hover:bg-muted/40 select-none border-y border-border"
                      >
                        <TableCell colSpan={columns.length} className="py-2.5 px-4">
                          <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                            {groupBy === 'project' ? (
                              <FolderIcon className="size-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ServerIcon className="size-4 text-muted-foreground shrink-0" />
                            )}
                            <span>{currentKey}</span>
                            <Badge variant="outline" className="text-xs font-normal">
                              {groupCount} {itemLabel}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                }

                return (
                  <Fragment key={row.id}>
                    {groupHeader}
                    <TableRow
                      onClick={(event) => {
                        if (
                          event.defaultPrevented ||
                          (event.target instanceof Element &&
                            event.target.closest('a, button, input, select, textarea, [role="button"], [role="combobox"], [role="menuitem"]'))
                        ) {
                          return;
                        }
                        props.onRowClick?.(row);
                      }}
                      className={cn(props.onRowClick && 'hover:bg-muted/50 cursor-pointer', props.rowClassName?.(row, rowIndex))}
                    >
                      {columns.map((col) => (
                        <TableCell key={col.id}>{col.renderCell(row, rowIndex)}</TableCell>
                      ))}
                    </TableRow>
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {showPagination && orderedTableData.meta && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-3">
            <div className="text-muted-foreground flex items-center text-sm">
              {tableData.meta.from && tableData.meta.to && (
                <span>
                  Showing {tableData.meta.from} to {tableData.meta.to}
                  {tableData.meta.total && ` of ${tableData.meta.total}`} results
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm whitespace-nowrap">Rows per page</span>
                <Select value={String(currentPerPage)} onValueChange={handlePerPageChange}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={String(currentPerPage)} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onPageChange(1)}
                  disabled={currentPage <= 1 || isProcessing}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isProcessing}
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center space-x-1">
                  {pageNumbers.map((p, idx) => {
                    if (p === 'ellipsis') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground select-none"
                        >
                          ...
                        </span>
                      );
                    }

                    const isCurrent = p === currentPage;

                    return (
                      <Button
                        key={p}
                        variant={isCurrent ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-8 min-w-8 px-2.5 text-xs font-medium cursor-pointer',
                          isCurrent && 'pointer-events-none font-semibold',
                        )}
                        onClick={() => onPageChange(p)}
                        disabled={isProcessing}
                      >
                        {p}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={
                    (lastPage ? currentPage >= lastPage : !tableData.links?.next) || isProcessing
                  }
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onPageChange(lastPage || currentPage + 1)}
                  disabled={
                    (lastPage ? currentPage >= lastPage : !tableData.links?.last) || isProcessing
                  }
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
