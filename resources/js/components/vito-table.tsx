import { Fragment, ReactNode, useEffect, useMemo } from 'react';
import { useTable, type InertiaTableData, type InertiaTableProps, type CellRenderProps } from '@forjedio/inertia-table-react';
import { Link, router } from '@inertiajs/react';
import { SOCKET_EVENT, type SocketEventData } from '@/stores/socket-store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TablePagination } from '@/components/table-pagination';
import { cn } from '@/lib/utils';
import {
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FolderIcon,
  LoaderCircleIcon,
  ServerIcon,
} from 'lucide-react';
import { orderTableColumns } from '@/lib/table-columns';

interface VitoTableProps extends Omit<InertiaTableProps, 'tableData'> {
  tableData: InertiaTableData;
  fitContent?: boolean;
  columnWidths?: Record<string, string>;
  children?: ReactNode;
  showPagination?: boolean;
  toolbar?: ReactNode;
  toolbarClassName?: string;
  groupBy?: 'project' | 'server' | 'none' | string | null;
  reloadOnly?: string[];
}

function getRealtimePrefix(tableData: InertiaTableData): string | undefined {
  const value = tableData.tableSettings?.realtime;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function resolveHref(display: CellRenderProps['displays'][number], row: CellRenderProps['row']): string | null {
  if (display.type !== 'link' || !display.href_key) return null;
  const href = row[display.href_key];
  if (typeof href !== 'string') return null;
  const url = new URL(href, 'http://localhost');
  return `${url.pathname}${url.search}${url.hash}`;
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

export function VitoTable({ tableData, children, modal, isFetching, showPagination = true, toolbar, groupBy, reloadOnly, fitContent = false, columnWidths, toolbarClassName, ...props }: VitoTableProps) {
  const orderedTableData = useMemo(() => {
    const rawCols = tableData?.columns ?? [];
    let cols = orderTableColumns(rawCols, (column) => column.name);
    if (groupBy === 'project') {
      cols = cols.filter((c) => c.name !== 'server.project.name' && c.name !== 'project.name');
    }
    return { ...tableData, columns: cols, data: tableData?.data ?? [] };
  }, [tableData, groupBy]);
  const { columns, searchTerm, onSearch, onSort, getSortState, onPageChange, isProcessing } = useTable({
    tableData: orderedTableData,
    modal,
    isFetching,
    renderCell: vitoCellRenderer as InertiaTableProps['renderCell'],
    ...props,
  });

  const currentPage = tableData?.meta?.current_page || 1;

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
  const reloadOnlyKey = reloadOnly?.join(',') ?? '';
  useEffect(() => {
    if (!realtimePrefix) return;
    const only = reloadOnlyKey ? reloadOnlyKey.split(',') : undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let reloadPending = false;
    const reloadWhenVisible = () => {
      if (document.visibilityState !== 'visible') {
        reloadPending = true;
        return;
      }
      reloadPending = false;
      router.reload(only ? { only } : {});
    };
    const handler = (e: Event) => {
      const type = (e as CustomEvent<SocketEventData>).detail?.type;
      if (type?.startsWith(`${realtimePrefix}.`)) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(reloadWhenVisible, 900);
      }
    };
    const visibilityHandler = () => {
      if (reloadPending) {
        reloadWhenVisible();
      }
    };
    window.addEventListener(SOCKET_EVENT, handler);
    document.addEventListener('visibilitychange', visibilityHandler);
    return () => {
      if (timeout) clearTimeout(timeout);
      window.removeEventListener(SOCKET_EVENT, handler);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [realtimePrefix, reloadOnlyKey]);

  const processing = isProcessing || isFetching;

  return (
    <div className="w-full">
      {(orderedTableData.searchable || toolbar) && (
        <div className={cn('mb-4 flex items-center gap-2', toolbar && 'mb-3 flex-wrap', toolbarClassName)}>
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

      <div className={cn('relative w-full overflow-hidden rounded-md border shadow-xs', modal && 'border-none shadow-none')}>
        <Table
          containerClassName={cn(modal && 'overflow-x-hidden', (fitContent || columnWidths) && 'overflow-x-hidden')}
          className={cn((fitContent || columnWidths) && 'table-fixed', fitContent && '[&_td]:whitespace-normal [&_td]:break-words [&_th]:whitespace-normal [&_svg]:shrink-0')}
        >
          <TableHeader>
            <TableRow>
              {(orderedTableData.columns ?? [])
                .filter((c) => !c.hidden)
                .map((colDef) => {
                  const sortState = getSortState(colDef.sort_key);

                  return (
                    <TableHead
                      style={columnWidths?.[colDef.name] ? { width: columnWidths[colDef.name] } : undefined}
                      key={colDef.name}
                      className={cn(
                        colDef.fit ? (fitContent ? 'w-20' : 'w-0') : undefined,
                      )}
                    >
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
            {(orderedTableData.data ?? []).length > 0 ? (
              (orderedTableData.data ?? []).map((row, rowIndex) => {
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
                    const groupRows = orderedTableData.data.filter((r) => {
                      const k =
                        groupBy === 'project'
                          ? String(r.project_name || r['server.project.name'] || r['project.name'] || 'Unknown Project')
                          : String(r.server_name || 'Unknown Server');
                      return k === currentKey;
                    });
                    const groupCount = groupRows.length;

                    const itemLabel = 'ip' in row
                      ? (groupCount === 1 ? 'server' : 'servers')
                      : (groupCount === 1 ? 'site' : 'sites');

                    let groupCostFormatted: string | null = null;
                    if (groupBy === 'project') {
                      const projectCost = row.project_monthly_cost as { amount?: number; formatted?: string } | null | undefined;
                      if (projectCost && typeof projectCost.amount === 'number' && projectCost.amount > 0 && projectCost.formatted) {
                        groupCostFormatted = projectCost.formatted;
                      } else {
                        const summed = groupRows.reduce((acc, r) => {
                          const c = r.monthly_cost as { amount?: number } | null | undefined;
                          return acc + (c && typeof c.amount === 'number' ? c.amount : 0);
                        }, 0);
                        if (summed > 0) {
                          groupCostFormatted = `€${summed.toFixed(2)}/mo`;
                        }
                      }
                    }

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
                            {groupCostFormatted && (
                              <Badge variant="secondary" className="font-mono text-xs font-normal">
                                {groupCostFormatted}
                              </Badge>
                            )}
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
                      {(columns ?? []).map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn(columnWidths && !columnWidths[col.id] && 'max-w-0 overflow-hidden')}
                        >
                          {col.renderCell(row, rowIndex)}
                        </TableCell>
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
          <TablePagination
            from={tableData.meta.from}
            to={tableData.meta.to}
            total={tableData.meta.total}
            currentPage={currentPage}
            lastPage={tableData.meta.last_page}
            hasNextLink={Boolean(tableData.links?.next)}
            hasLastLink={Boolean(tableData.links?.last)}
            perPage={currentPerPage}
            disabled={isProcessing}
            onPageChange={onPageChange}
            onPerPageChange={handlePerPageChange}
          />
        )}
      </div>

      {children}
    </div>
  );
}
