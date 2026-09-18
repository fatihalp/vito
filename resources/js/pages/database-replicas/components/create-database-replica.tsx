import { FormEvent, useState } from 'react';
import { useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { Server } from '@/types/server';
import { PostgresCluster } from '@/types/database-replica';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import ServerSelect from '@/pages/servers/components/server-select';
import StorageProviderSelect from '@/pages/storage-providers/components/storage-provider-select';
import PgBackRestFields, { PgBackRestSettings, pgBackRestDefaults } from '@/pages/backups/components/pgbackrest-fields';

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
  const [replicaServer, setReplicaServer] = useState<Server | undefined>(undefined);
  const needsBackup = !cluster?.backup;
  const form = useForm<{ replica_server_id: string; max_slot_wal_keep_size_gb: string; backup: PgBackRestSettings & { storage: string } }>({
    replica_server_id: '',
    max_slot_wal_keep_size_gb: '64',
    backup: { storage: '', ...pgBackRestDefaults() },
  });
  const errors = form.errors as Record<string, string | undefined>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.transform((data) => (needsBackup ? data : { replica_server_id: data.replica_server_id, max_slot_wal_keep_size_gb: data.max_slot_wal_keep_size_gb }));
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
              Vito connects both servers over a private network (a Hetzner Cloud Network when both are Hetzner servers in one network zone, else a network they share, else an encrypted WireGuard network), opens PostgreSQL and
              pgBackRest only to the replica, restores the replica from the latest pgBackRest backup and streams WAL from this server. Backups then run
              on the replica straight to S3. PostgreSQL on this server restarts once to listen on its private address, and all PostgreSQL data on the
              replica server is replaced.
            </div>

            <FormField>
              <Label htmlFor="replica_server_id">Replica server</Label>
              <ServerSelect
                id="replica_server_id"
                value={form.data.replica_server_id}
                onValueChange={(selected) => {
                  setReplicaServer(selected);
                  form.setData('replica_server_id', selected ? String(selected.id) : '');
                }}
              />
              {replicaServer && replicaServer.services?.database !== 'postgresql' && (
                <p className="text-destructive text-sm">Install PostgreSQL on {replicaServer.name} first.</p>
              )}
              <InputError message={form.errors.replica_server_id} />
            </FormField>

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
              <InputError message={form.errors.max_slot_wal_keep_size_gb} />
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
            <Button form="create-database-replica-form" type="submit" disabled={form.processing}>
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
