import { FormEvent, useState } from 'react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircle, PlugZapIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import StorageProviderSelect from '@/pages/storage-providers/components/storage-provider-select';
import ServerSelect from '@/pages/servers/components/server-select';
import DatabaseSelect from '@/pages/databases/components/database-select';
import { Server } from '@/types/server';
import axios from 'axios';
import { toast } from 'sonner';

function TestConnectionButton({ storageId, label, mode }: { storageId: string; label: string; mode: 'read' | 'write' }) {
  const [testing, setTesting] = useState(false);
  const access = mode === 'read' ? 'read' : 'write';

  const test = async () => {
    setTesting(true);
    try {
      const { data } = await axios.post<{ connected: boolean }>(
        route('storage-providers.test', { storageProvider: storageId }),
        {},
        { params: mode === 'read' ? { mode: 'read' } : undefined },
      );
      if (data.connected) {
        toast.success(`Connected: ${access} access to the ${label} storage verified.`);
      } else {
        toast.error(`Could not verify ${access} access to the ${label} storage.`);
      }
    } catch {
      toast.error(`Could not verify ${access} access to the ${label} storage.`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" disabled={!storageId || testing} onClick={() => void test()}>
      {testing ? <LoaderCircle className="animate-spin" /> : <PlugZapIcon />}
      Test connection
    </Button>
  );
}

export default function CreateStorageMigration({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [server, setServer] = useState<Server>();
  const form = useForm<{
    name: string;
    source_storage_id: string;
    target_storage_id: string;
    server_id: string;
    database_id: string;
    overwrite: boolean;
  }>({
    name: '',
    source_storage_id: '',
    target_storage_id: '',
    server_id: '',
    database_id: '',
    overwrite: false,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('storage-migrations.store'), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-3xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Migrate storage</SheetTitle>
          <SheetDescription>Copies everything under the source storage's path to the target, including data not created by Vito. New backups switch to the target immediately.</SheetDescription>
        </SheetHeader>
        <Form id="create-storage-migration-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="source_storage_id">Source storage</Label>
              <div className="flex items-center gap-2">
                <StorageProviderSelect
                  id="source_storage_id"
                  value={form.data.source_storage_id}
                  onValueChange={(value) => form.setData('source_storage_id', value)}
                  filter={(storageProvider) => storageProvider.provider === 's3'}
                  className="flex-1"
                />
                <TestConnectionButton storageId={form.data.source_storage_id} label="source" mode="read" />
              </div>
              <InputError message={form.errors.source_storage_id} />
            </FormField>

            <FormField>
              <Label htmlFor="target_storage_id">Target storage</Label>
              <div className="flex items-center gap-2">
                <StorageProviderSelect
                  id="target_storage_id"
                  value={form.data.target_storage_id}
                  onValueChange={(value) => form.setData('target_storage_id', value)}
                  excludeId={form.data.source_storage_id}
                  filter={(storageProvider) => storageProvider.provider === 's3'}
                  className="flex-1"
                />
                <TestConnectionButton storageId={form.data.target_storage_id} label="target" mode="write" />
              </div>
              <InputError message={form.errors.target_storage_id} />
            </FormField>

            <FormField>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="overwrite"
                  checked={form.data.overwrite}
                  onCheckedChange={(checked) => form.setData('overwrite', !!checked)}
                />
                <Label htmlFor="overwrite" className="cursor-pointer">Overwrite mismatched objects on the target</Label>
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                If an object already exists at the target path with a different size, overwrite it instead of failing that file.
              </div>
              <InputError message={form.errors.overwrite} />
            </FormField>

            <FormField>
              <Label htmlFor="server_id">Scan database server</Label>
              <ServerSelect
                id="server_id"
                value={form.data.server_id}
                onValueChange={(selected) => {
                  setServer(selected);
                  form.setData((data) => ({ ...data, server_id: selected ? String(selected.id) : '', database_id: '' }));
                }}
              />
              <div className="text-muted-foreground text-sm">
                Discovered objects and their transfer status are stored here instead of Vito's own database. Vito creates a database user for this
                migration. For another server, Vito also opens the database port to the Vito server, which restarts the database service if remote
                access is off.
              </div>
              <InputError message={form.errors.server_id} />
            </FormField>

            {server && (
              <FormField>
                <Label htmlFor="database_id">Scan database</Label>
                {server.services.database ? (
                  <DatabaseSelect
                    id="database_id"
                    serverId={server.id}
                    value={form.data.database_id}
                    onValueChange={(value) => form.setData('database_id', value)}
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">This server has no database service.</div>
                )}
                <InputError message={form.errors.database_id} />
              </FormField>
            )}
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button
              form="create-storage-migration-form"
              type="submit"
              disabled={form.processing || !form.data.name || !form.data.source_storage_id || !form.data.target_storage_id || !form.data.database_id}
            >
              {form.processing && <LoaderCircle className="animate-spin" />}
              Start migration
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
