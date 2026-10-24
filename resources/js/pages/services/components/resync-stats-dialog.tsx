import { Service } from '@/types/service';
import { useForm } from '@inertiajs/react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';
import InputError from '@/components/ui/input-error';
import type { DialogControlProps } from '@/components/dialogs/registry';

export default function ResyncStatsDialog({ service, open, onOpenChange }: { service: Service } & DialogControlProps) {
  const form = useForm();

  const submit = () => {
    form.post(`/servers/${service.server_id}/log-analysis/resync`, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-sync stats scripts</DialogTitle>
          <DialogDescription className="sr-only">Re-sync GoAccess scripts and cron on the server</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 p-4">
          <p>
            This re-writes the GoAccess processing scripts and per-site configs on the server and ensures the cron is in place. Run this after a Vito
            update.
          </p>
          {Object.entries(form.errors).map(([key, value]) => (
            <InputError key={key} message={value as string | undefined} />
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button disabled={form.processing} onClick={submit}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            Re-sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
