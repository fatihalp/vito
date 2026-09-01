import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircleIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { router } from '@inertiajs/react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const lastPage = paginatedData?.meta?.last_page;
  const pageNumbers = useMemo(() => getPaginationPages(currentPage, lastPage), [currentPage, lastPage]);

  const goToPage = (pageNumber: number) => {
    if (onPageChange) {
      onPageChange(pageNumber);
      return;
    }

    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    const pageParams = ['page', 'sourceControlsPage', 'logsPage', 'serversPage', 'sitesPage', 'usersPage'];
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

    const currentParams = new URLSearchParams(window.location.search);
    const sortBy = currentParams.get('sort_by');
    const sortDir = currentParams.get('sort_dir');
    const perPage = currentParams.get('per_page');

    if (sortBy) url.searchParams.set('sort_by', sortBy);
    if (sortDir) url.searchParams.set('sort_dir', sortDir);
    if (perPage) url.searchParams.set('per_page', perPage);

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  const handlePerPageChange = (newPerPage: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('per_page', newPerPage);

    const pageParams = ['page', 'sourceControlsPage', 'logsPage', 'serversPage', 'sitesPage', 'usersPage'];
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

    const pageParams = ['page', 'sourceControlsPage', 'logsPage', 'serversPage', 'sitesPage', 'usersPage'];
    for (const p of pageParams) {
      if (params.has(p)) {
        params.set(p, '1');
      }
    }

    router.get(url.toString(), {}, { preserveState: true, preserveScroll: true });
  };

  const handlePageChange = (url: string) => {
    if (onPageChange) {
      
      const urlObj = new URL(url);
      const page = urlObj.searchParams.get('page');
      if (page) {
        onPageChange(parseInt(page));
        return;
      }

      onPageChange(1);
    } else {
      
      const urlObj = new URL(url);

      
      if (searchQuery) {
        urlObj.searchParams.set('search', searchQuery);
      }

      
      const currentParams = new URLSearchParams(window.location.search);
      const sortBy = currentParams.get('sort_by');
      const sortDir = currentParams.get('sort_dir');
      const perPage = currentParams.get('per_page');

      if (sortBy) {
        urlObj.searchParams.set('sort_by', sortBy);
      }
      if (sortDir) {
        urlObj.searchParams.set('sort_dir', sortDir);
      }
      if (perPage) {
        urlObj.searchParams.set('per_page', perPage);
      }

      router.get(urlObj.toString(), {}, { preserveState: true, preserveScroll: true });
    }
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
    if (paginatedData) {
      setIsSearching(true);
      const url = new URL(paginatedData.meta.path);
      if (searchQuery.length > 0) {
        url.searchParams.set('search', searchQuery);
      }

      
      const currentParams = new URLSearchParams(window.location.search);
      const sortBy = currentParams.get('sort_by');
      const sortDir = currentParams.get('sort_dir');

      if (sortBy) {
        url.searchParams.set('sort_by', sortBy);
      }
      if (sortDir) {
        url.searchParams.set('sort_dir', sortDir);
      }

      router.get(
        url.toString(),
        {},
        {
          preserveState: true,
          preserveScroll: true,
          onSuccess: () => {
            setIsSearching(false);
          },
        },
      );
    }
  };

  return (
    <div>
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
      <div className={cn('relative overflow-hidden rounded-md border shadow-xs', className, extraClasses)}>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-3">
            <div className="text-muted-foreground flex items-center text-sm">
              {paginatedData.meta.from && paginatedData.meta.to && (
                <span>
                  Showing {paginatedData.meta.from} to {paginatedData.meta.to}
                  {paginatedData.meta.total && ` of ${paginatedData.meta.total}`} results
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
                  onClick={() => goToPage(1)}
                  disabled={currentPage <= 1 || isFetching}
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || isFetching}
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
                        onClick={() => goToPage(p)}
                        disabled={isFetching}
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
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={(lastPage ? currentPage >= lastPage : !paginatedData.links?.next) || isFetching}
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => goToPage(lastPage || currentPage + 1)}
                  disabled={(lastPage ? currentPage >= lastPage : !paginatedData.links?.last) || isFetching}
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
