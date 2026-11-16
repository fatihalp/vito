import { Backup } from '@/types/backup';
import { BackupFile } from '@/types/backup-file';
import { Server } from '@/types/server';
import { useForm, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import DatabaseSelect from '@/pages/databases/components/database-select';
import ServerSelect from '@/pages/servers/components/server-select';

export default function RestoreBackup({
  open,
  onOpenChange,
  backup,
  file,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backup: Backup;
  file: BackupFile;
}) {
  const page = usePage<{ server?: Server }>();
  const sourceServerName = page.props.server?.name ?? 'Original server';
  const [targetServerId, setTargetServerId] = useState(backup.server_id);
  const [targetServerName, setTargetServerName] = useState<string | undefined>(sourceServerName);

  const form = useForm({
    database: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(
      `/servers/${backup.server_id}/backups/${backup.id}/files/${file.id}/restore`,
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Restore backup</DialogTitle>
          <DialogDescription className="sr-only">Restore backup</DialogDescription>
        </DialogHeader>
        <Form id="restore-backup-form" onSubmit={submit} className="p-4">
          <FormFields>
            <div className="text-muted-foreground text-sm">
              {file.database_engine
                ? `Source: ${file.database_engine} ${file.database_version ?? ''}`.trim()
                : 'Source database engine/version unknown - this file can only be restored to its original server.'}
            </div>
            <FormField>
              <Label htmlFor="target-server">To server</Label>
              <ServerSelect
                id="target-server"
                value={String(targetServerId)}
                placeholder={targetServerName ?? 'Select server...'}
                onValueChange={(server) => {
                  if (server) {
                    setTargetServerId(server.id);
                    setTargetServerName(server.name);
                  } else {
                    setTargetServerId(backup.server_id);
                    setTargetServerName(sourceServerName);
                  }
                  form.setData('database', '');
                }}
              />
            </FormField>
            <FormField>
              <Label htmlFor="database">To database</Label>
              <DatabaseSelect
                id="database"
                name="database"
                serverId={targetServerId}
                value={form.data.database}
                onValueChange={(value) => form.setData('database', value)}
              />
              <InputError message={form.errors.database} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={form.processing}>
              Cancel
            </Button>
          </DialogClose>
          <Button form="restore-backup-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
