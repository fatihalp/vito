import { ReactNode, useState } from 'react';
import { ChevronDownIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface BannerItem {
  key: string;
  severity?: 'info' | 'warning';
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

export function BannerRow({ item }: { item: BannerItem }) {
  const Icon = item.severity === 'info' ? InfoIcon : TriangleAlertIcon;
  return (
    <div className="flex flex-wrap items-start gap-3 px-4 py-3">
      <Icon className={`h-4 w-4 shrink-0 ${item.severity === 'info' ? 'text-sky-600 dark:text-sky-400' : 'text-warning'}`} />
      <div className="min-w-0 flex-1 basis-64 text-sm leading-relaxed">
        <p className="font-medium">{item.title}</p>
        <div className="text-muted-foreground">{item.description}</div>
      </div>
      {item.action && <div className="shrink-0">{item.action}</div>}
    </div>
  );
}

export function WarningsBlock({ items, summaryLabel }: { items: BannerItem[]; summaryLabel?: (count: number) => string }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;
  const warningCount = items.filter((item) => item.severity !== 'info').length;
  const Icon = warningCount > 0 ? TriangleAlertIcon : InfoIcon;
  const color = warningCount > 0 ? 'border-warning/40 bg-warning/5' : 'border-sky-500/30 bg-sky-500/5';

  if (items.length === 1) {
    return (
      <div className={`${color} rounded-lg border`}>
        <BannerRow item={items[0]} />
      </div>
    );
  }

  const label = warningCount === 0 ? `${items.length} site ${items.length === 1 ? 'note' : 'notes'}` : summaryLabel ? summaryLabel(warningCount) : `${warningCount} warnings require your attention`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`${color} rounded-lg border`}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left">
          <Icon className={`h-4 w-4 shrink-0 ${warningCount > 0 ? 'text-warning' : 'text-sky-600 dark:text-sky-400'}`} />
          <span className="flex-1 text-sm font-medium">{label}</span>
          <ChevronDownIcon className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-warning/25 space-y-0 border-t">
            {items.map((item, i) => (
              <div key={item.key} className={i > 0 ? 'border-warning/25 border-t' : ''}>
                <BannerRow item={item} />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function WarningsPopover({ items }: { items: BannerItem[] }) {
  if (items.length === 0) return null;

  const warningCount = items.filter((item) => item.severity !== 'info').length;
  const Icon = warningCount > 0 ? TriangleAlertIcon : InfoIcon;
  const label = warningCount > 0 ? `${warningCount} site ${warningCount === 1 ? 'warning' : 'warnings'}` : `${items.length} site ${items.length === 1 ? 'note' : 'notes'}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label={label}>
          <Icon className={warningCount > 0 ? 'text-warning' : 'text-sky-600 dark:text-sky-400'} />
          <span className="sr-only">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[36rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">{label}</p>
        </div>
        <div className="divide-y">
          {items.map((item) => (
            <BannerRow key={item.key} item={item} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
