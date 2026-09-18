import { Link } from '@inertiajs/react';
import { BellOffIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type BackupAttention = { id: number; title: string; problems: string[]; href?: string };

export default function BackupHealthAlerts({ items, hasNotificationChannels }: { items: BackupAttention[]; hasNotificationChannels: boolean }) {
  return (
    <>
      {!hasNotificationChannels && (
        <Alert>
          <BellOffIcon />
          <AlertTitle>Backup alerts go nowhere</AlertTitle>
          <AlertDescription>
            <p>
              There is no notification channel, so nobody is told when a backup fails, stops running or loses WAL.{' '}
              <Link href={route('notification-channels')} className="text-foreground underline">
                Add a notification channel
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      )}
      {items.map((item) => (
        <Alert key={item.id} variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{item.title} needs attention</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {item.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            {item.href && (
              <Link href={item.href} className="underline">
                View backup
              </Link>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </>
  );
}
