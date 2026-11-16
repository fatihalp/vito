import { useTranslate } from '@/hooks/use-translate';
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
  const translateText = useTranslate();
  const form = useForm({ force: false, confirmation: '' });
  const lag = replica.latest_metric?.lag_bytes;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(`/servers/${replica.primary_server_id}/database-replicas/${replica.id}/promote`, {
      preserveScroll: true,
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{translateText("Fail over to")} {replica.replica_server_name}</DialogTitle>
          <DialogDescription>{translateText("Make this replica the new primary of the cluster.")}</DialogDescription>
        </DialogHeader>
        <Form id="promote-database-replica-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="flex flex-col gap-2 text-sm">
              <p>{translateText("Pure will, in order:")}</p>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5">
                <li>{translateText("Stop PostgreSQL, WAL archiving and the pgBackRest server on")} {replica.primary_server_name} {translateText("and keep PostgreSQL from starting again.")}</li>
                <li>{translateText("Promote")} {replica.replica_server_name} {translateText("and continue WAL archiving and backups from it.")}</li>
                <li>{translateText("Point the other replicas at the new primary and take a full backup.")}</li>
                <li>{translateText("Mark")} {replica.primary_server_name} {translateText("as needing a rebuild, so you can add it back as a replica.")}</li>
              </ol>
              <p>
                {translateText("Lag at the last check:")} <strong>{lag != null ? formatBytes(lag) : translateText("unknown")}</strong>{translateText(". Commits that did not reach the replica are lost. This cannot be undone.")}
              </p>
              <p className="text-muted-foreground">{translateText("Pure does not change your applications. Point them at the new primary afterwards.")}</p>
            </div>

            <FormField>
              <Label htmlFor="confirmation">
                {translateText('Type')} <strong>{replica.replica_server_name}</strong> {translateText("to confirm")}
              </Label>
              <Input id="confirmation" autoComplete="off" value={form.data.confirmation} onChange={(e) => form.setData('confirmation', e.target.value)} />
              <InputError message={form.errors.confirmation} />
            </FormField>

            <FormField>
              <div className="flex items-start gap-2">
                <Checkbox id="force" checked={form.data.force} onCheckedChange={(checked) => form.setData('force', checked === true)} />
                <Label htmlFor="force" className="leading-snug font-normal">
                  {translateText("The old primary is down or unreachable, or this replica is behind, and I still want to fail over.")}
                </Label>
              </div>
              <InputError message={form.errors.force} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline">{translateText('Cancel')}</Button>
            </DialogClose>
            <Button form="promote-database-replica-form" type="submit" variant="destructive" disabled={form.processing || form.data.confirmation !== replica.replica_server_name}>
              {form.processing && <LoaderCircle className="animate-spin" />}
              {translateText("Fail over")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
