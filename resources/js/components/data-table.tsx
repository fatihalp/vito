import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { LoaderCircleIcon, ChevronsUpDownIcon, ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import { router } from '@inertiajs/react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/table-pagination';
import { cn } from '@/lib/utils';
import { PaginatedData } from '@/types';
import { Input } from './ui/input';
import { useEffect, useMemo, useState } from 'react';
import { orderTableColumns } from '@/lib/table-columns';

function SortIndicator({ sortKey }: { sortKey: string }) {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const current = params.get('sort_by');
  const dir = params.get('sort_dir') || 'desc';

  if (current !== sortKey) {
    return <ChevronsUpDownIcon className="text-muted-foreground inline-block h-4 w-4" />;
  }

  return dir === 'asc' ? (
    <ChevronUpIcon className="text-muted-foreground inline-block h-4 w-4" />
  ) : (
    <ChevronDownIcon className="text-muted-foreground inline-block h-4 w-4" />
  );
}

const pageParams = ['page', 'sourceControlsPage', 'logsPage', 'serversPage', 'sitesPage', 'usersPage'];

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  paginatedData?: PaginatedData<TData>;
  data?: TData[];
  className?: string;
  modal?: boolean;
  onPageChange?: (page: number) => void;
  isFetching?: boolean;
  isLoading?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  paginatedData,
  data,
  className,
  modal,
  onPageChange,
  isFetching,
  isLoading,
  searchable,
  sortable = true,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  
  const tableData = paginatedData?.data || data || [];
  const orderedColumns = useMemo(
    () =>
      orderTableColumns(columns, (column) =>
        column.id ?? ('accessorKey' in column && typeof column.accessorKey === 'string' ? column.accessorKey : undefined),
      ),
    [columns],
  );

  const table = useReactTable({
    data: tableData,
    columns: orderedColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const extraClasses = modal && 'border-none shadow-none';

  const [isInitialSearch, setIsInitialSearch] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('search') || '';
    }
    return '';
  });
  const [isSearching, setIsSearching] = useState(false);

  const currentPerPage = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('per_page') || params.get('perPage');
      if (fromUrl && ['10', '25', '50'].includes(fromUrl)) {
        return fromUrl;
      }
    }
    if (paginatedData?.meta?.per_page) {
      return String(paginatedData.meta.per_page);
    }
    return '25';
  }, [paginatedData?.meta?.per_page]);

  const currentPage = paginatedData?.meta?.current_page || 1;

  const goToPage = (pageNumber: number) => {
    if (onPageChange) {
      onPageChange(pageNumber);
      return;
    }

    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    let pageParamSet = false;
    for (const p of pageParams) {
      if (url.searchParams.has(p)) {
        url.searchParams.set(p, String(pageNumber));
        pageParamSet = true;
      }
    }
    if (!pageParamSet) {
      url.searchParams.set('page', String(pageNumber));
    }

    if (searchQuery) {
      url.searchParams.set('search', searchQuery);
    }

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  const handlePerPageChange = (newPerPage: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('per_page', newPerPage);

    let pageParamReset = false;
    for (const p of pageParams) {
      if (url.searchParams.has(p)) {
        url.searchParams.set(p, '1');
        pageParamReset = true;
      }
    }
    if (!pageParamReset) {
      url.searchParams.set('page', '1');
    }

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  const handleSort = (sortKey: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    const current = params.get('sort_by');
    const currentDir = params.get('sort_dir') || 'desc';

    if (current !== sortKey) {
      params.set('sort_by', sortKey);
      params.set('sort_dir', 'asc');
    } else {
      params.set('sort_dir', currentDir === 'asc' ? 'desc' : 'asc');
    }

    for (const p of pageParams) {
      if (params.has(p)) {
        params.set(p, '1');
      }
    }

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!isInitialSearch) {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleSearch = () => {
    if (!paginatedData) {
      return;
    }

    setIsSearching(true);
    const url = new URL(window.location.href);
    if (searchQuery.length > 0) {
      url.searchParams.set('search', searchQuery);
    } else {
      url.searchParams.delete('search');
    }
    for (const p of pageParams) {
      url.searchParams.delete(p);
    }

    router.get(
      url.toString(),
      {},
      {
        preserveState: true,
        preserveScroll: true,
        onFinish: () => {
          setIsSearching(false);
        },
      },
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        {searchable && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search..."
              className="max-w-sm"
              value={searchQuery}
              onChange={(e) => {
                setIsInitialSearch(false);
                setSearchQuery(e.target.value);
              }}
            />
            {isSearching && <LoaderCircleIcon className="text-muted-foreground animate-spin" />}
          </div>
        )}
      </div>
      <div className={cn('relative w-full overflow-hidden rounded-md border shadow-xs', className, extraClasses)}>
        {isLoading && (
          <div className="absolute top-0 right-0 left-0 h-[2px] overflow-hidden">
            <div className="animate-loading-bar bg-primary absolute inset-0 w-full" />
          </div>
        )}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = sortable && header.column.getCanSort();

                  
                  const sortKey = header.id;

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-2"
                          onClick={() => handleSort(sortKey)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIndicator sortKey={sortKey} />
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? 'hover:bg-muted/50 cursor-pointer' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {paginatedData && (
          <TablePagination
            from={paginatedData.meta.from}
            to={paginatedData.meta.to}
            total={paginatedData.meta.total}
            currentPage={currentPage}
            lastPage={paginatedData.meta.last_page}
            hasNextLink={Boolean(paginatedData.links?.next)}
            hasLastLink={Boolean(paginatedData.links?.last)}
            perPage={currentPerPage}
            perPageLabel="Rows per page"
            disabled={isFetching}
            onPageChange={goToPage}
            onPerPageChange={handlePerPageChange}
          />
        )}
      </div>
    </div>
  );
}
