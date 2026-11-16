import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import type { BackupMonitorServer } from '@/types/backup-monitor';
import { useTranslate } from '@/hooks/use-translate';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoaderCircleIcon } from 'lucide-react';

type Field = {
  key: 'label' | 'report_path' | 'max_age_hours' | 'backup_unit' | 'verify_unit';
  label: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
};

const fields: Field[] = [
  { key: 'label', label: 'Name', required: true, maxLength: 160 },
  { key: 'report_path', label: 'JSON report path', required: true, maxLength: 512, placeholder: '/var/lib/backups/project.json' },
  { key: 'max_age_hours', label: 'Maximum backup age (hours)', required: true },
  { key: 'backup_unit', label: 'Backup service (optional)', maxLength: 128, placeholder: 'project-backup.service' },
  { key: 'verify_unit', label: 'Recovery verification service (optional)', maxLength: 128, placeholder: 'project-verify.service' },
];

const selectors = [
  { key: 'server_id', id: 'monitor-target', label: 'Application server' },
  { key: 'report_server_id', id: 'monitor-source', label: 'Report server' },
] as const;

export default function MonitorForm({ open, onOpenChange, servers, serverId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: BackupMonitorServer[];
  serverId?: number;
}) {
  const translateText = useTranslate();
  const form = useForm({
    server_id: serverId ? String(serverId) : '',
    report_server_id: serverId ? String(serverId) : '',
    label: '', report_path: '', max_age_hours: 36, backup_unit: '', verify_unit: '',
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/servers/${form.data.server_id}/backup-monitors`, {
      preserveScroll: true,
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>{translateText('Monitor an existing backup')}</DialogTitle>
          <DialogDescription>
            {translateText('Connect a root-owned JSON status report and optional existing systemd tasks. This does not install or reschedule backups. The same server and label update the existing monitor.')}
          </DialogDescription>
        </DialogHeader>
        <form id="backup-monitor-form" onSubmit={submit} className="grid min-h-0 gap-4 overflow-y-auto p-4">
          {selectors.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={field.id}>{translateText(field.label)}</Label>
              <Select value={form.data[field.key]} onValueChange={(value) => form.setData(field.key, value)}>
                <SelectTrigger id={field.id}><SelectValue placeholder={translateText('Select server...')} /></SelectTrigger>
                <SelectContent>
                  {servers.map((server) => <SelectItem key={server.id} value={String(server.id)}>{server.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <InputError message={form.errors[field.key]} />
            </div>
          ))}
          {fields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={`monitor-${field.key}`}>{translateText(field.label)}</Label>
              <Input
                id={`monitor-${field.key}`}
                type={field.key === 'max_age_hours' ? 'number' : 'text'}
                min={field.key === 'max_age_hours' ? 1 : undefined}
                max={field.key === 'max_age_hours' ? 168 : undefined}
                maxLength={field.maxLength}
                required={field.required}
                placeholder={field.placeholder}
                value={form.data[field.key]}
                onChange={(event) => field.key === 'max_age_hours'
                  ? form.setData(field.key, Number(event.target.value))
                  : form.setData(field.key, event.target.value)}
              />
              {field.key === 'report_path' && (
                <p className="text-muted-foreground text-xs">
                  {translateText('A regular root-owned file under 64 KiB, without group/other write permissions or symlinked parents.')}
                </p>
              )}
              <InputError message={form.errors[field.key]} />
            </div>
          ))}
        </form>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{translateText('Cancel')}</Button>
          <Button type="submit" form="backup-monitor-form" disabled={form.processing || !form.data.server_id || !form.data.report_server_id}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            {translateText('Connect monitoring')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
