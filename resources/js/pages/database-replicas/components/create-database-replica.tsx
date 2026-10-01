import { FormEvent, useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import axios from 'axios';
import { LoaderCircle } from 'lucide-react';
import { Server } from '@/types/server';
import { PostgresCluster } from '@/types/database-replica';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StorageProviderSelect from '@/pages/storage-providers/components/storage-provider-select';
import PgBackRestFields, { PgBackRestSettings, pgBackRestDefaults } from '@/pages/backups/components/pgbackrest-fields';
import ProvisionServerFields, { PlanFit, ServerRequirements } from '@/pages/servers/components/provision-server-fields';

type Candidate = { id: number; name: string; ip: string | null; postgresql: string | null; databases: number; sites: number; issue: string | null };

export default function CreateDatabaseReplica({
  open,
  onOpenChange,
  server,
  cluster,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: Server;
  cluster: PostgresCluster | null;
}) {
  const [requirements, setRequirements] = useState<ServerRequirements | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [planFit, setPlanFit] = useState<PlanFit>({ blocked: null, warnings: [] });
  const needsBackup = !cluster?.backup;
  const form = useForm<{
    mode: 'new' | 'existing';
    name: string;
    server_provider: string;
    region: string;
    plan: string;
    replica_server_id: string;
    confirmation: string;
    max_slot_wal_keep_size_gb: string;
    backup: PgBackRestSettings & { storage: string };
  }>({
    mode: 'new',
    name: `${server.name}-replica`,
    server_provider: '',
    region: '',
    plan: '',
    replica_server_id: '',
    confirmation: '',
    max_slot_wal_keep_size_gb: '64',
    backup: { storage: '', ...pgBackRestDefaults() },
  });
  const errors = form.errors as Record<string, string | undefined>;
  const selected = candidates.find((candidate) => String(candidate.id) === form.data.replica_server_id);
  const usable = candidates.filter((candidate) => candidate.issue === null);

  useEffect(() => {
    if (!open) return;

    axios
      .get<{ requirements: ServerRequirements; candidates: Candidate[] }>(route('database-replicas.requirements', { server: server.id }))
      .then((response) => {
        setRequirements(response.data.requirements);
        setCandidates(response.data.candidates);
      })
      .catch(() => {
        setRequirements(null);
        setCandidates([]);
      });
  }, [open, server.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.transform((data) => ({
      mode: data.mode,
      max_slot_wal_keep_size_gb: data.max_slot_wal_keep_size_gb,
      ...(data.mode === 'new'
        ? { name: data.name, server_provider: data.server_provider, region: data.region, plan: data.plan }
        : { replica_server_id: data.replica_server_id, confirmation: data.confirmation }),
      ...(needsBackup ? { backup: data.backup } : {}),
    }));
    form.post(route('database-replicas.store', { server: server.id }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Create replica of {server.name}</SheetTitle>
          <SheetDescription className="sr-only">Create a PostgreSQL streaming replica</SheetDescription>
        </SheetHeader>
        <Form id="create-database-replica-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="text-muted-foreground rounded-md border p-3 text-sm">
              Vito connects both servers over a private network (a provider network such as a Hetzner Cloud Network when it can, else an encrypted WireGuard
              network), opens PostgreSQL and pgBackRest only to the replica, restores the replica from the latest pgBackRest backup and streams WAL from this
              server. Backups then run on the replica straight to S3. PostgreSQL on this server restarts once to listen on its private address.
            </div>

            <FormField>
              <Label>Replica server</Label>
              <Select value={form.data.mode} onValueChange={(mode) => form.setData((data) => ({ ...data, mode: mode as 'new' | 'existing', replica_server_id: '', confirmation: '' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create a new server for this replica</SelectItem>
                  <SelectItem value="existing">Use a server I already have</SelectItem>
                </SelectContent>
              </Select>
              <InputError message={errors.mode} />
            </FormField>

            {form.data.mode === 'new' ? (
              <>
                <div className="flex flex-col gap-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">The new server</p>
                  <p className="text-muted-foreground">
                    Vito creates it at your provider (billed by the provider) with the same operating system and PostgreSQL {requirements?.postgresql ?? ''} as{' '}
                    {server.name}, and nothing else on it, so no data of yours can be replaced by the restore.
                  </p>
                  {requirements && (
                    <p className="text-muted-foreground">
                      It needs <span className="text-foreground font-medium">at least {requirements.storage_gb ?? '?'} GB of disk</span>,{' '}
                      {requirements.cores ?? '?'} vCPU and {requirements.memory_gb ?? '?'} GB of memory to keep up with {server.name}, on a{' '}
                      {requirements.architecture ?? 'matching'} processor — a streaming replica copies the data files byte for byte.
                    </p>
                  )}
                </div>

                <ProvisionServerFields
                  data={{ name: form.data.name, server_provider: form.data.server_provider, region: form.data.region, plan: form.data.plan }}
                  setData={(patch) => form.setData((data) => ({ ...data, ...patch }))}
                  errors={errors}
                  requirements={requirements}
                  onFitChange={setPlanFit}
                  warningSuffix={`The replica may fall behind ${server.name} under load.`}
                />
              </>
            ) : (
              <>
                <FormField>
                  <Label htmlFor="replica_server_id">Server</Label>
                  <Select value={form.data.replica_server_id} onValueChange={(value) => form.setData((data) => ({ ...data, replica_server_id: value, confirmation: '' }))}>
                    <SelectTrigger id="replica_server_id">
                      <SelectValue placeholder={candidates.length === 0 ? 'Loading the servers…' : 'Select a server'} />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={String(candidate.id)} disabled={candidate.issue !== null}>
                          {candidate.name}
                          {candidate.ip ? ` (${candidate.ip})` : ''}
                          {candidate.issue ? ` — ${candidate.issue}` : candidate.postgresql ? ` — PostgreSQL ${candidate.postgresql}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {candidates.length > 0 && usable.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      No server in this project can hold a replica. Create a new server instead, or install PostgreSQL {requirements?.postgresql ?? ''} on an
                      empty server.
                    </p>
                  )}
                  <InputError message={errors.replica_server_id} />
                </FormField>

                {selected && (
                  <>
                    <Alert variant="destructive">
                      <AlertTitle>Everything PostgreSQL holds on {selected.name} is destroyed</AlertTitle>
                      <AlertDescription>
                        Vito wipes the PostgreSQL data directory of {selected.name} and restores this server's backup over it. The server keeps{' '}
                        {selected.sites === 1 ? '1 site' : `${selected.sites} sites`} and everything outside PostgreSQL, but its databases cannot be recovered
                        afterwards unless you have your own backup of them.
                      </AlertDescription>
                    </Alert>

                    <FormField>
                      <Label htmlFor="confirmation">Type {selected.name} to confirm</Label>
                      <Input
                        id="confirmation"
                        autoComplete="off"
                        value={form.data.confirmation}
                        onChange={(e) => form.setData('confirmation', e.target.value)}
                        placeholder={selected.name}
                      />
                      <InputError message={errors.confirmation} />
                    </FormField>
                  </>
                )}
              </>
            )}

            <FormField>
              <Label htmlFor="max_slot_wal_keep_size_gb">WAL kept for a disconnected replica (GB)</Label>
              <Input
                id="max_slot_wal_keep_size_gb"
                type="number"
                min={1}
                value={form.data.max_slot_wal_keep_size_gb}
                onChange={(e) => form.setData('max_slot_wal_keep_size_gb', e.target.value)}
              />
              <p className="text-muted-foreground text-sm">
                When a replica falls this far behind, PostgreSQL drops its WAL instead of filling this server's disk, and the replica needs a rebuild.
              </p>
              <InputError message={errors.max_slot_wal_keep_size_gb} />
            </FormField>

            {needsBackup && (
              <>
                <div className="text-muted-foreground rounded-md border p-3 text-sm">
                  Replicas are built from pgBackRest backups, and this server has none yet. Choose where to keep them and a strategy. The replica is
                  created as soon as the first full backup finishes.
                </div>
                <FormField>
                  <Label htmlFor="storage">S3 storage</Label>
                  <StorageProviderSelect
                    id="storage"
                    name="storage"
                    value={form.data.backup.storage}
                    onValueChange={(value) => form.setData('backup', { ...form.data.backup, storage: value })}
                    filter={(storageProvider) => storageProvider.provider === 's3'}
                  />
                  <InputError message={errors['backup.storage'] ?? errors.storage} />
                </FormField>
                <PgBackRestFields
                  data={form.data.backup}
                  errors={{
                    strategy: errors.strategy,
                    full_schedule: errors.full_schedule,
                    diff_schedule: errors.diff_schedule,
                    incr_schedule: errors.incr_schedule,
                    retention_full: errors.retention_full,
                    retention_diff: errors.retention_diff,
                    process_max: errors.process_max,
                    wal_queue_max_gb: errors.wal_queue_max_gb,
                  }}
                  onChange={(key, value) => form.setData('backup', { ...form.data.backup, [key]: value })}
                />
              </>
            )}
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button
              form="create-database-replica-form"
              type="submit"
              disabled={form.processing || (form.data.mode === 'new' && Boolean(planFit.blocked)) || (form.data.mode === 'existing' && !selected)}
            >
              {form.processing && <LoaderCircle className="animate-spin" />}
              Create
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
