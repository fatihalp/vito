import { FormEvent, useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Backup } from '@/types/backup';
import { BackupFile } from '@/types/backup-file';
import { RestoreRequirements } from '@/types/backup-restore';
import ProvisionServerFields, { PlanFit } from '@/pages/servers/components/provision-server-fields';

export default function RestoreToServer({
  open,
  onOpenChange,
  backup,
  file,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backup: Backup;
  file?: BackupFile;
}) {
  const [requirements, setRequirements] = useState<RestoreRequirements | null>(null);
  const [planFit, setPlanFit] = useState<PlanFit>({ blocked: null, warnings: [] });
  const form = useForm({
    name: `restore-${backup.pgbackrest?.stanza ?? backup.id}`,
    server_provider: '',
    region: '',
    plan: '',
    target: file ? 'backup' : 'latest',
    backup_file_id: file ? String(file.id) : '',
    target_time: '',
  });

  useEffect(() => {
    if (!open) return;

    axios
      .get<RestoreRequirements>(route('backups.restore-to-server.requirements', { server: backup.server_id, backup: backup.id }))
      .then((response) => setRequirements(response.data))
      .catch(() => setRequirements(null));
  }, [open, backup.server_id, backup.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.transform((data) => ({ ...data, target_time: data.target === 'time' && data.target_time ? new Date(data.target_time).toISOString() : '' }));
    form.post(route('backups.restore-to-server', { server: backup.server_id, backup: backup.id }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Restore to a new server</SheetTitle>
          <SheetDescription className="sr-only">Create a server and restore this backup onto it</SheetDescription>
        </SheetHeader>
        <Form id="restore-to-server-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="text-muted-foreground rounded-md border p-3 text-sm">
              Vito creates a server at your provider (billed by the provider), installs the same operating system and PostgreSQL version as{' '}
              {requirements?.source ?? 'the source'}, and restores the backup onto it. The copy is independent: it doesn't connect to the source, archive WAL or
              take backups, and Vito removes the backup storage credentials from it when the restore finishes. It holds every database and user in the
              backup.
            </div>

            <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <p className="font-medium">The new server needs</p>
              {requirements === null ? (
                <p className="text-muted-foreground">Loading the requirements…</p>
              ) : (
                <>
                  <p>
                    <span className="font-medium">Storage: {requirements.storage_gb !== null ? `at least ${requirements.storage_gb} GB` : 'unknown'}.</span>{' '}
                    {requirements.measured && requirements.database_size !== null
                      ? `The largest backed-up database is ${(requirements.database_size / 1073741824).toFixed(1)} GB when restored.`
                      : `Until a backup reports its database size, this is based on the disk ${requirements.source} uses.`}{' '}
                    The rest covers WAL replay, 20% growth and the operating system.
                  </p>
                  <p>
                    <span className="font-medium">
                      vCPU: {requirements.cores ?? 'unknown'} · Memory: {requirements.memory_gb !== null ? `${requirements.memory_gb} GB` : 'unknown'}
                    </span>{' '}
                    or more, like {requirements.source}, so the restored database performs the same and its PostgreSQL settings fit.
                  </p>
                  <p>
                    <span className="font-medium">
                      Processor: {requirements.architecture ?? 'same as the source'} · {requirements.os.replace('_', ' ')} · PostgreSQL {requirements.postgresql}
                    </span>
                    . PostgreSQL data files are only safe on the same processor architecture.
                  </p>
                </>
              )}
            </div>

            <ProvisionServerFields
              data={{ name: form.data.name, server_provider: form.data.server_provider, region: form.data.region, plan: form.data.plan }}
              setData={(patch) => form.setData((data) => ({ ...data, ...patch }))}
              errors={form.errors as Record<string, string | undefined>}
              requirements={requirements}
              onFitChange={setPlanFit}
              warningSuffix="That's fine for checking data, not for replacing it."
            />

            <FormField>
              <Label>Restore point</Label>
              <Select value={form.data.target} onValueChange={(target) => form.setData('target', target)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest: the last backup plus all archived WAL</SelectItem>
                  {file && <SelectItem value="backup">Backup {file.name}, as it was when it finished</SelectItem>}
                  <SelectItem value="time">A point in time</SelectItem>
                </SelectContent>
              </Select>
              <InputError message={form.errors.target || form.errors.backup_file_id} />
            </FormField>

            {form.data.target === 'time' && (
              <FormField>
                <Label htmlFor="restore-time">Point in time (your local time)</Label>
                <Input id="restore-time" type="datetime-local" step="1" value={form.data.target_time} onChange={(e) => form.setData('target_time', e.target.value)} />
                <InputError message={form.errors.target_time} />
              </FormField>
            )}

            <InputError message={(form.errors as Record<string, string | undefined>).backup || (form.errors as Record<string, string | undefined>).provider} />
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button form="restore-to-server-form" type="submit" disabled={form.processing || Boolean(planFit.blocked)}>
              {form.processing && <LoaderCircle className="animate-spin" />}
              Create server and restore
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
