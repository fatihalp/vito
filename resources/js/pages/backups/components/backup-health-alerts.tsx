import { Link } from '@inertiajs/react';
import { ArrowRightIcon, BellOffIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type BackupAttention = { id: number; title: string; problems: string[]; href?: string };

export default function BackupHealthAlerts({ items, hasNotificationChannels }: { items: BackupAttention[]; hasNotificationChannels: boolean }) {
  if (hasNotificationChannels && items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {!hasNotificationChannels && (
        <div
          role="status"
          className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <BellOffIcon className="text-muted-foreground size-4 shrink-0" />
            <span className="text-muted-foreground truncate">No notification channel configured for backup alerts.</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="h-7 shrink-0 px-2.5 text-xs">
            <Link href="/settings/notification-channels">
              Add channel
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          role="alert"
          className="border-destructive/30 bg-destructive/5 flex flex-col gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-destructive flex min-w-0 items-center gap-2 font-medium">
              <TriangleAlertIcon className="size-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </div>
            {item.href && (
              <Link href={item.href} className="text-destructive shrink-0 text-xs font-medium underline underline-offset-4">
                Open
              </Link>
            )}
          </div>
          <ul className="text-destructive/90 list-disc space-y-0.5 pl-6 text-xs">
            {item.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
