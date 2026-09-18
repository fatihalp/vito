import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { LoaderCircle, TriangleAlertIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import DateTime from '@/components/date-time';

type Setting = {
  max_processes: number;
  scan_max_processes: number;
  applied_max_processes: number | null;
  applied_scan_max_processes: number | null;
  applied_at: string | null;
  needs_apply: boolean;
  max_allowed_processes: number;
};

export default function QueueSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [applying, setApplying] = useState(false);

  const form = useForm<{ max_processes: string; scan_max_processes: string }>({
    max_processes: '1',
    scan_max_processes: '1',
  });

  const load = async () => {
    const { data } = await axios.get<{ setting: Setting }>(route('storage-migrations.settings'));
    setSetting(data.setting);
    form.setData({
      max_processes: String(data.setting.max_processes),
      scan_max_processes: String(data.setting.scan_max_processes),
    });
  };

  useEffect(() => {
    if (open) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    form.post(route('storage-migrations.settings.update'), {
      preserveScroll: true,
      onSuccess: () => void load(),
    });
  };

  const apply = async () => {
    setApplying(true);
    try {
      await axios.post(route('storage-migrations.settings.apply'));
      toast.warning('Applied. The Horizon master process was restarted — your process supervisor must bring it back up.');
      await load();
    } catch {
      toast.error('Could not apply the queue settings.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Storage migration queue settings</DialogTitle>
          <DialogDescription>Worker process count for the scan and copy queues.</DialogDescription>
        </DialogHeader>

        <Form id="queue-settings-form" onSubmit={submit} className="flex flex-col gap-4">
          <FormFields>
            <FormField>
              <Label htmlFor="max_processes">Copy workers</Label>
              <Input
                id="max_processes"
                type="number"
                min={1}
                max={setting?.max_allowed_processes ?? 10}
                value={form.data.max_processes}
                onChange={(e) => form.setData('max_processes', e.target.value)}
              />
              <InputError message={form.errors.max_processes} />
            </FormField>

            <FormField>
              <Label htmlFor="scan_max_processes">Scan workers</Label>
              <Input
                id="scan_max_processes"
                type="number"
                min={1}
                max={setting?.max_allowed_processes ?? 10}
                value={form.data.scan_max_processes}
                onChange={(e) => form.setData('scan_max_processes', e.target.value)}
              />
              <InputError message={form.errors.scan_max_processes} />
            </FormField>
          </FormFields>
        </Form>

        {setting && (
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-start gap-2">
              <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />
              <div className="text-muted-foreground">
                Saving only stores the numbers above. Applying restarts the entire Horizon master process — every queue app-wide (backups, SSH,
                certbot, not just storage migration) stops until your process supervisor restarts it.
              </div>
            </div>
            <div className="mt-2">
              {setting.applied_at ? (
                <span>
                  Currently applied: {setting.applied_max_processes} copy / {setting.applied_scan_max_processes} scan, as of{' '}
                  <DateTime date={setting.applied_at} relative />
                </span>
              ) : (
                <span>Never applied — workers are still running on whatever was last set in .env directly.</span>
              )}
              {setting.needs_apply && <span className="text-warning-foreground"> · saved changes are not applied yet</span>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="submit" form="queue-settings-form" disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            Save
          </Button>
          <Button type="button" variant="destructive" onClick={() => void apply()} disabled={applying || !setting?.needs_apply}>
            {applying && <LoaderCircle className="animate-spin" />}
            Apply to workers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
