import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react';
import React, { forwardRef } from 'react';

export interface TableActionTriggerProps extends React.ComponentPropsWithoutRef<typeof Button> {
  label?: string;
  iconOnly?: boolean;
}

export const TableActionTrigger = forwardRef<HTMLButtonElement, TableActionTriggerProps>(
  ({ className, label = 'Menu', iconOnly = false, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant="outline"
        size="sm"
        className={cn(
          'h-7 px-2 text-xs font-medium gap-1 border shadow-2xs hover:bg-accent text-foreground shrink-0 cursor-pointer',
          iconOnly && 'w-7 p-0',
          className
        )}
        {...props}
      >
        {children || (
          <>
            <MoreHorizontalIcon className="size-3.5 text-muted-foreground" />
            {!iconOnly && <span>{label}</span>}
            {!iconOnly && <ChevronDownIcon className="size-3 text-muted-foreground opacity-60" />}
          </>
        )}
      </Button>
    );
  }
);

TableActionTrigger.displayName = 'TableActionTrigger';
