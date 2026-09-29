import { FormEvent, useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from '@/types/server';
import { ServerProvider } from '@/types/server-provider';
import { UpgradeRequirements } from '@/types/database-upgrade';

type Plan = { label: string; available: boolean; cores?: number; memory?: number; disk?: number; architecture?: string | null };

function gigabytes(bytes: number): string {
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function fit(plan: Plan, requirements: UpgradeRequirements | null): { blocked: string | null; warnings: string[] } {
  if (!requirements) return { blocked: null, warnings: [] };

  const warnings: string[] = [];
  let blocked: string | null = null;

  if (plan.disk !== undefined && plan.disk < requirements.storage_gb) {
    blocked = `${plan.disk} GB disk is too small`;
  }
  if (plan.cores !== undefined && requirements.cores !== null && plan.cores < requirements.cores) {
    warnings.push(`fewer vCPU than ${requirements.source}`);
  }
  if (plan.memory !== undefined && requirements.memory_gb !== null && plan.memory < requirements.memory_gb) {
    warnings.push(`less memory than ${requirements.source}`);
  }

  return { blocked, warnings };
}

export default function CreateDatabaseUpgrade({ open, onOpenChange, server }: { open: boolean; onOpenChange: (open: boolean) => void; server: Server }) {
  const [requirements, setRequirements] = useState<UpgradeRequirements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ServerProvider[]>([]);
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const form = useForm({
    name: `${server.name}-pg`,
    server_provider: '',
    region: '',
    plan: '',
    version: '',
    restart: false,
    replica_identity: 'full',
  });
  const selected = plans[form.data.plan] ? fit(plans[form.data.plan], requirements) : null;
  const setData = form.setData;

  useEffect(() => {
    if (!open) return;

    axios
      .get<UpgradeRequirements>(route('database-upgrades.requirements', { server: server.id }))
      .then((response) => {
        setRequirements(response.data);
        setError(null);
        setData('version', response.data.versions[0] ?? '');
      })
      .catch(() => {
        setRequirements(null);
        setError('Vito could not read the PostgreSQL settings of this server.');
      });
    axios
      .get<ServerProvider[]>(route('server-providers.json'))
      .then((response) => setProviders(response.data))
      .catch(() => setProviders([]));
  }, [open, server.id, setData]);

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
        setPlans(
          Object.fromEntries(Object.entries(response.data).map(([name, plan]) => [name, typeof plan === 'string' ? { label: plan, available: true } : plan])),
        ),
      )
      .catch(() => setPlans({}));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('database-upgrades.store', { server: server.id }), { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Upgrade PostgreSQL on a new server</SheetTitle>
          <SheetDescription className="sr-only">Create a server with a newer PostgreSQL and copy every database to it</SheetDescription>
        </SheetHeader>
        <Form id="create-database-upgrade-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="text-muted-foreground rounded-md border p-3 text-sm">
              Vito creates a server at your provider (billed by the provider), installs the PostgreSQL version you pick, and copies every database, role and
              schema of {requirements?.source ?? server.name} onto it with logical replication. {requirements?.source ?? server.name} keeps serving reads and
              writes the whole time, and you decide when to switch over.
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            {requirements && (
              <>
                <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">The new server needs</p>
                  <p>
                    <span className="font-medium">Storage: at least {requirements.storage_gb} GB.</span> The {requirements.databases.length} databases of{' '}
                    {requirements.source} hold {gigabytes(requirements.database_size)}; the rest covers indexes, growth and the operating system.
                  </p>
                  <p>
                    <span className="font-medium">
                      vCPU: {requirements.cores ?? 'unknown'} · Memory: {requirements.memory_gb !== null ? `${requirements.memory_gb} GB` : 'unknown'}
                    </span>{' '}
                    or more, like {requirements.source}. Any processor architecture works: the rows are copied, not the data files.
                  </p>
                </div>

                {requirements.warnings.length > 0 && (
                  <Alert>
                    <AlertTitle>What logical replication does not copy</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-4">
                        {requirements.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            <FormField>
              <Label>PostgreSQL version</Label>
              <Select value={form.data.version} onValueChange={(version) => form.setData('version', version)} disabled={!requirements?.versions.length}>
                <SelectTrigger>
                  <SelectValue placeholder={requirements ? 'Select a version' : 'Reading the current version…'} />
                </SelectTrigger>
                <SelectContent>
                  {(requirements?.versions ?? []).map((version) => (
                    <SelectItem key={version} value={version}>
                      PostgreSQL {version}
                      {requirements ? ` (now ${requirements.version})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.version} />
            </FormField>

            <FormField>
              <Label htmlFor="upgrade-name">Server name</Label>
              <Input id="upgrade-name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
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
                <p className="text-warning text-sm">This plan has {selected.warnings.join(' and ')}, so the new server may be slower than {requirements?.source}.</p>
              )}
              <InputError message={form.errors.plan} />
            </FormField>

            {requirements && requirements.tables_without_key_count > 0 && (
              <FormField>
                <Label>Tables without a primary key ({requirements.tables_without_key_count})</Label>
                <Select value={form.data.replica_identity} onValueChange={(value) => form.setData('replica_identity', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Set REPLICA IDENTITY FULL on them, so they keep working</SelectItem>
                    <SelectItem value="leave">Leave them, UPDATE and DELETE on them fail while the copy runs</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  For example {requirements.tables_without_key.slice(0, 3).join(', ')}. REPLICA IDENTITY FULL makes PostgreSQL write the whole old row for
                  updates on those tables while the copy runs, and costs nothing once it is over.
                </p>
                <InputError message={form.errors.replica_identity} />
              </FormField>
            )}

            {requirements?.restart_needed && (
              <FormField>
                <div className="flex items-center gap-2">
                  <Checkbox id="upgrade-restart" checked={form.data.restart} onClick={() => form.setData('restart', !form.data.restart)} />
                  <Label htmlFor="upgrade-restart">Restart PostgreSQL on {requirements.source} once</Label>
                </div>
                <p className="text-muted-foreground text-sm">
                  Logical replication needs wal_level = logical and {requirements.required_slots} replication slots, which only apply after a restart. Vito
                  restarts PostgreSQL once, early in the upgrade, and open connections are dropped at that moment.
                </p>
                <InputError message={form.errors.restart} />
              </FormField>
            )}
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button form="create-database-upgrade-form" type="submit" disabled={form.processing || requirements === null || Boolean(selected?.blocked)}>
              {form.processing && <LoaderCircle className="animate-spin" />}
              Create server and start copying
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
