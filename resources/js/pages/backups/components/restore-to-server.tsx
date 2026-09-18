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
import { ServerProvider } from '@/types/server-provider';
import { RestoreRequirements } from '@/types/backup-restore';

type Plan = { label: string; available: boolean; cores?: number; memory?: number; disk?: number; architecture?: string | null };

function fit(plan: Plan, requirements: RestoreRequirements | null): { blocked: string | null; warnings: string[] } {
  if (!requirements) return { blocked: null, warnings: [] };

  const warnings: string[] = [];
  let blocked: string | null = null;

  if (plan.disk !== undefined && requirements.storage_gb !== null && plan.disk < requirements.storage_gb) {
    blocked = `${plan.disk} GB disk is too small`;
  }
  if (plan.architecture && requirements.architecture && plan.architecture !== requirements.architecture) {
    blocked = `${plan.architecture} processor, ${requirements.source} is ${requirements.architecture}`;
  }
  if (plan.cores !== undefined && requirements.cores !== null && plan.cores < requirements.cores) {
    warnings.push(`fewer vCPU than ${requirements.source}`);
  }
  if (plan.memory !== undefined && requirements.memory_gb !== null && plan.memory < requirements.memory_gb) {
    warnings.push(`less memory than ${requirements.source}`);
  }

  return { blocked, warnings };
}

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
  const [providers, setProviders] = useState<ServerProvider[]>([]);
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const form = useForm({
    name: `restore-${backup.pgbackrest?.stanza ?? backup.id}`,
    server_provider: '',
    region: '',
    plan: '',
    target: file ? 'backup' : 'latest',
    backup_file_id: file ? String(file.id) : '',
    target_time: '',
  });
  const selected = plans[form.data.plan] ? fit(plans[form.data.plan], requirements) : null;

  useEffect(() => {
    if (!open) return;

    axios
      .get<RestoreRequirements>(route('backups.restore-to-server.requirements', { server: backup.server_id, backup: backup.id }))
      .then((response) => setRequirements(response.data))
      .catch(() => setRequirements(null));
    axios
      .get<ServerProvider[]>(route('server-providers.json'))
      .then((response) => setProviders(response.data))
      .catch(() => setProviders([]));
  }, [open, backup.server_id, backup.id]);

  const selectProvider = (id: string) => {
    form.setData((data) => ({ ...data, server_provider: id, region: '', plan: '' }));
    setRegions({});
    setPlans({});
    axios
      .get<Record<string, string>>(route('server-providers.regions', { serverProvider: id }))
      .then((response) => setRegions(response.data))
      .catch(() => setRegions({}));
  };

  const selectRegion = (region: string) => {
    form.setData((data) => ({ ...data, region, plan: '' }));
    setPlans({});
    axios
      .get<Record<string, Plan | string>>(route('server-providers.plans', { serverProvider: form.data.server_provider, region }))
      .then((response) =>
        setPlans(Object.fromEntries(Object.entries(response.data).map(([name, plan]) => [name, typeof plan === 'string' ? { label: plan, available: true } : plan]))),
      )
      .catch(() => setPlans({}));
  };

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

            <FormField>
              <Label htmlFor="restore-name">Server name</Label>
              <Input id="restore-name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label>Provider</Label>
              <Select value={form.data.server_provider} onValueChange={selectProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a server provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={String(provider.id)}>
                      {provider.name} ({provider.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.server_provider} />
            </FormField>

            <FormField>
              <Label>Region</Label>
              <Select value={form.data.region} onValueChange={selectRegion} disabled={Object.keys(regions).length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(regions).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.region} />
            </FormField>

            <FormField>
              <Label>Plan</Label>
              <Select value={form.data.plan} onValueChange={(plan) => form.setData('plan', plan)} disabled={Object.keys(plans).length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(plans).map(([name, plan]) => {
                    const check = fit(plan, requirements);

                    return (
                      <SelectItem key={name} value={name} disabled={!plan.available || check.blocked !== null}>
                        {plan.label}
                        {check.blocked ? ` — ${check.blocked}` : check.warnings.length > 0 ? ` — ${check.warnings.join(', ')}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selected && selected.warnings.length > 0 && (
                <p className="text-warning text-sm">This plan has {selected.warnings.join(' and ')}. That's fine for checking data, not for replacing it.</p>
              )}
              <InputError message={form.errors.plan} />
            </FormField>

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
            <Button form="restore-to-server-form" type="submit" disabled={form.processing || Boolean(selected?.blocked)}>
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
