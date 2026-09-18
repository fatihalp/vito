import { FormField } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Backup } from '@/types/backup';

export type PgBackRestSettings = {
  strategy: string;
  full_schedule: string;
  diff_schedule: string;
  incr_schedule: string;
  retention_full: string;
  retention_diff: string;
  process_max: string;
  wal_queue_max_gb: string;
};

export function pgBackRestDefaults(backup?: Backup): PgBackRestSettings {
  const settings = backup?.pgbackrest;

  return {
    strategy: 'standard',
    full_schedule: settings?.schedules?.full ?? '0 2 * * 0',
    diff_schedule: settings?.schedules?.diff ?? '0 2 * * 1-6',
    incr_schedule: settings?.schedules?.incr ?? '0 * * * *',
    retention_full: String(settings?.retention?.full ?? 4),
    retention_diff: settings?.retention ? String(settings.retention.diff ?? '') : '7',
    process_max: String(settings?.process_max ?? 4),
    wal_queue_max_gb: String(settings?.wal_queue_max_gb ?? 10),
  };
}

export default function PgBackRestFields({
  data,
  errors,
  onChange,
}: {
  data: PgBackRestSettings;
  errors: Partial<Record<keyof PgBackRestSettings, string>>;
  onChange: (key: keyof PgBackRestSettings, value: string) => void;
}) {
  return (
    <>
      <FormField>
        <Label>Backup strategy</Label>
        <div className="text-muted-foreground rounded-md border p-3 text-sm">
          <strong className="text-foreground">Standard.</strong> Full backup every Sunday 02:00, differential the other days at 02:00, incremental every hour.
          Keeps 4 full backups with continuous WAL, so you can restore to any second of the last 4 weeks. Verified every Saturday, checked daily.
        </div>
        <InputError message={errors.strategy} />
      </FormField>

      <FormField>
        <Label htmlFor="process_max">Parallel processes</Label>
        <Input id="process_max" type="number" min={1} value={data.process_max} onChange={(e) => onChange('process_max', e.target.value)} />
        <div className="text-muted-foreground text-sm">Processes that compress and upload at the same time. Keep this below the server's CPU count so PostgreSQL stays responsive.</div>
        <InputError message={errors.process_max} />
      </FormField>

      <FormField>
        <Label htmlFor="wal_queue_max_gb">WAL queue limit (GiB)</Label>
        <Input id="wal_queue_max_gb" type="number" min={1} value={data.wal_queue_max_gb} onChange={(e) => onChange('wal_queue_max_gb', e.target.value)} />
        <div className="text-muted-foreground text-sm">
          If S3 is unreachable and unarchived WAL grows past this size, pgBackRest drops it so the disk doesn't fill. Point-in-time recovery then has a gap until the next backup, and Vito notifies you.
        </div>
        <InputError message={errors.wal_queue_max_gb} />
      </FormField>
    </>
  );
}
