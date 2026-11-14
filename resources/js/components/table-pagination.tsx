import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

interface TablePaginationProps {
  from?: number | null;
  to?: number | null;
  total?: number | null;
  currentPage: number;
  lastPage?: number;
  hasNextLink: boolean;
  hasLastLink: boolean;
  perPage: string;
  perPageLabel?: string;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: string) => void;
}

export function TablePagination({
  from,
  to,
  total,
  currentPage,
  lastPage,
  hasNextLink,
  hasLastLink,
  perPage,
  perPageLabel,
  disabled,
  onPageChange,
  onPerPageChange,
}: TablePaginationProps) {
  const pageNumbers = useMemo(() => getPaginationPages(currentPage, lastPage), [currentPage, lastPage]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t px-4 py-3">
      <div className="text-muted-foreground flex items-center text-sm">
        {from && to && (
          <span>
            Showing {from} to {to}
            {total && ` of ${total}`} results
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {perPageLabel && <span className="text-muted-foreground text-sm whitespace-nowrap">{perPageLabel}</span>}
          <Select value={perPage} onValueChange={onPerPageChange}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={perPage} />
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
            disabled={currentPage <= 1 || disabled}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || disabled}
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
                  className={cn('h-8 min-w-8 px-2.5 text-xs font-medium cursor-pointer', isCurrent && 'pointer-events-none font-semibold')}
                  onClick={() => onPageChange(p)}
                  disabled={disabled}
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
            disabled={(lastPage ? currentPage >= lastPage : !hasNextLink) || disabled}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => onPageChange(lastPage || currentPage + 1)}
            disabled={(lastPage ? currentPage >= lastPage : !hasLastLink) || disabled}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
