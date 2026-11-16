import { router, useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { BackupMonitor } from '@/types/backup-monitor';
import { useTranslate } from '@/hooks/use-translate';
import { useDialog } from '@/hooks/use-dialog';
import DateTime from '@/components/date-time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import InputError from '@/components/ui/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';

const reportErrors: Record<string, string> = {
  backup_failed: 'The external backup reported a failure. Review the registered service logs before relying on it.',
  overdue: 'The last successful backup is older than the configured limit.',
  unverified: 'The report does not provide enough current evidence to confirm backup health.',
  verification_attention: 'The recovery verification failed or is overdue. Review it before relying on this backup.',
  read_failed: 'The report could not be read. Check SSH access, file ownership and JSON format.',
};

function MonitorCard({ monitor }: { monitor: BackupMonitor }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  const form = useForm<{ task?: 'backup' | 'verify' }>({});
  const url = `/servers/${monitor.server_id}/backup-monitors/${monitor.id}`;
  const requestTask = (task: 'backup' | 'verify') => dialog.confirm.open({
    title: translateText(task === 'backup' ? 'Run registered backup task' : 'Run registered recovery verification'),
    description: translateText('This starts the administrator-registered external task using its configured backup or verification policy. Task submission does not confirm success.'),
    confirmLabel: translateText('Run'),
    method: 'post',
    url: `${url}/run`,
    data: { task },
    options: { preserveScroll: true },
  });
  const stale = !monitor.last_checked_at || Date.now() - Date.parse(monitor.last_checked_at) > 15 * 60_000;

  return (
    <Card id={`backup-monitor-${monitor.id}`}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><CardTitle className="break-words">{monitor.label}</CardTitle><p className="text-muted-foreground text-sm">{monitor.server_name}</p></div>
        <Badge variant={stale ? 'warning' : monitor.status_color}>{translateText(stale ? 'Status needs refresh' : monitor.status)}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">{translateText('Last successful backup')}</dt><dd>{monitor.details.last_success_at ? <DateTime date={monitor.details.last_success_at} /> : translateText('Not verified')}</dd></div>
          <div><dt className="text-muted-foreground">{translateText('Recovery verification')}</dt><dd>{translateText(monitor.details.restore_state ?? 'unknown')}{monitor.details.restore_verified_at && <span className="block text-muted-foreground"><DateTime date={monitor.details.restore_verified_at} /></span>}</dd></div>
          <div><dt className="text-muted-foreground">{translateText('Last status check')}</dt><dd>{monitor.last_checked_at ? <DateTime date={monitor.last_checked_at} /> : translateText('Not checked')}</dd></div>
          {!!monitor.details.snapshots?.length && <div><dt className="text-muted-foreground">{translateText('Snapshot IDs')}</dt><dd className="break-all font-mono text-xs">{monitor.details.snapshots.map((id) => id.slice(0, 12)).join(', ')}</dd></div>}
        </dl>
        {monitor.details.error_code && <Alert><AlertDescription>{translateText(reportErrors[monitor.details.error_code] ?? reportErrors.unverified)}</AlertDescription></Alert>}
        {monitor.task_requested_at && <p className="text-muted-foreground text-xs">{translateText('Last task request')}: {translateText(monitor.last_task === 'verify' ? 'Recovery verification' : 'Backup')} · {translateText(monitor.task_state ?? 'unknown')} · <DateTime date={monitor.task_requested_at} /></p>}
        {monitor.task_state === 'failed' && <Alert variant="destructive"><AlertDescription>{translateText('The registered task could not be started. Check its service and permissions.')}</AlertDescription></Alert>}
        {Object.values(form.errors).map((error) => <InputError key={error} message={error} />)}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={form.processing} onClick={() => form.post(`${url}/refresh`, { preserveScroll: true })}>{form.processing ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}{translateText('Refresh')}</Button>
          {monitor.can_run_backup && <Button variant="outline" size="sm" onClick={() => requestTask('backup')}>{translateText('Run backup')}</Button>}
          {monitor.can_run_verify && <Button variant="outline" size="sm" onClick={() => requestTask('verify')}>{translateText('Verify recovery')}</Button>}
          {monitor.can_delete && <Button variant="ghost" size="sm" onClick={() => dialog.confirm.open({title: translateText('Remove backup monitoring'), description: translateText('This removes monitoring only. External schedules and stored backups are kept.'), confirmLabel: translateText('Remove'), method: 'delete', url, variant: 'destructive'})}>{translateText('Remove')}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BackupMonitors({ monitors }: { monitors: BackupMonitor[] }) {
  const translateText = useTranslate();
  useEffect(() => {
    if (!monitors.length) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.reload({ only: ['backupMonitors'] });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [monitors.length]);
  if (!monitors.length) return null;

  return <section className="flex flex-col gap-3"><h3 className="text-lg font-semibold">{translateText('Existing backup monitoring')}</h3><p className="text-muted-foreground text-sm">{translateText('Reported backup health and recovery checks. These observations do not create another backup schedule.')}</p><div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{monitors.map((monitor) => <MonitorCard key={monitor.id} monitor={monitor} />)}</div></section>;
}
