import DateTime from '@/components/date-time';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function RelativeDate({ date, className }: { date: string | null | undefined; className?: string }) {
  if (!date) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap text-xs', className)}
          aria-label="Show exact date"
        >
          <DateTime date={date} relative />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-xs" align="end">
        <DateTime date={date} />
      </PopoverContent>
    </Popover>
  );
}
