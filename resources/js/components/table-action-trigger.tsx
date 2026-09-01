import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react';
import React, { forwardRef } from 'react';

export interface TableActionTriggerProps extends React.ComponentPropsWithoutRef<typeof Button> {
  label?: string;
  iconOnly?: boolean;
}

export const TableActionTrigger = forwardRef<HTMLButtonElement, TableActionTriggerProps>(
  ({ className, label = 'Actions', iconOnly = true, variant = 'outline', children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        variant={variant}
        size={iconOnly ? 'icon' : 'sm'}
        className={cn(
          iconOnly
            ? 'size-8 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer shadow-2xs'
            : 'h-8 px-2.5 text-xs font-medium gap-1 border shadow-2xs hover:bg-accent text-foreground shrink-0 cursor-pointer',
          className
        )}
        {...props}
      >
        {children || (
          <>
            <MoreHorizontalIcon className="size-4" />
            {!iconOnly && <span>{label}</span>}
            {!iconOnly && <ChevronDownIcon className="size-3.5 text-muted-foreground opacity-60" />}
            {iconOnly && <span className="sr-only">{label}</span>}
          </>
        )}
      </Button>
    );
  }
);

TableActionTrigger.displayName = 'TableActionTrigger';
