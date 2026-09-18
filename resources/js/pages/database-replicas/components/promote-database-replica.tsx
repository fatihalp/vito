import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { formatBytes } from '@/lib/utils';
import { DatabaseReplica } from '@/types/database-replica';

export default function PromoteDatabaseReplica({
  open,
  onOpenChange,
  replica,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replica: DatabaseReplica;
}) {
  const form = useForm({ force: false, confirmation: '' });
  const lag = replica.latest_metric?.lag_bytes;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('database-replicas.promote', { server: replica.primary_server_id, databaseReplica: replica.id }), {
      preserveScroll: true,
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fail over to {replica.replica_server_name}</DialogTitle>
          <DialogDescription>Make this replica the new primary of the cluster.</DialogDescription>
        </DialogHeader>
        <Form id="promote-database-replica-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="flex flex-col gap-2 text-sm">
              <p>Vito will, in order:</p>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                <li>Stop PostgreSQL, WAL archiving and the pgBackRest server on {replica.primary_server_name} and keep PostgreSQL from starting again.</li>
                <li>Promote {replica.replica_server_name} and continue WAL archiving and backups from it.</li>
                <li>Point the other replicas at the new primary and take a full backup.</li>
                <li>Mark {replica.primary_server_name} as needing a rebuild, so you can add it back as a replica.</li>
              </ol>
              <p>
                Lag at the last check: <strong>{lag != null ? formatBytes(lag) : 'unknown'}</strong>. Commits that did not reach the replica are lost.
                This cannot be undone.
              </p>
              <p className="text-muted-foreground">Vito does not change your applications. Point them at the new primary afterwards.</p>
            </div>

            <FormField>
              <Label htmlFor="confirmation">
                Type <strong>{replica.replica_server_name}</strong> to confirm
              </Label>
              <Input id="confirmation" autoComplete="off" value={form.data.confirmation} onChange={(e) => form.setData('confirmation', e.target.value)} />
              <InputError message={form.errors.confirmation} />
            </FormField>

            <FormField>
              <div className="flex items-start gap-2">
                <Checkbox id="force" checked={form.data.force} onCheckedChange={(checked) => form.setData('force', checked === true)} />
                <Label htmlFor="force" className="leading-snug font-normal">
                  The old primary is down or unreachable, or this replica is behind, and I still want to fail over.
                </Label>
              </div>
              <InputError message={form.errors.force} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button form="promote-database-replica-form" type="submit" variant="destructive" disabled={form.processing || form.data.confirmation !== replica.replica_server_name}>
              {form.processing && <LoaderCircle className="animate-spin" />}
              Fail over
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
