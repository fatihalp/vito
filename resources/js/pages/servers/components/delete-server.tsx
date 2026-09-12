import { Server } from '@/types/server';
import { FormEvent, ReactNode, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { LoaderCircleIcon } from 'lucide-react';
import serverHelper from '@/lib/server-helper';
import { SharedData } from '@/types';
import siteHelper from '@/lib/site-helper';

export default function DeleteServer({ server, children }: { server: Server; children: ReactNode }) {
  if (server.is_self) {
    return null;
  }

  const page = usePage<SharedData>();
  const [open, setOpen] = useState(false);

  const form = useForm<{ name: string }>({
    name: '',
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      form.reset();
      form.clearErrors();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.delete(route('servers.destroy', server.id), {
      onSuccess: () => {
        serverHelper.removeRecentServer(page.props.auth.user.id, server.project_id, server.id);
        siteHelper.removeRecentServerSites(page.props.auth.user.id, server.project_id, server.id);
        setOpen(false);
      },
    });
  };

  const submitDisabled = form.processing || form.data.name !== server.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {server.name} from Vito</DialogTitle>
          <DialogDescription className="sr-only">Remove server from Vito.</DialogDescription>
        </DialogHeader>

        <p className="p-4 text-sm text-muted-foreground">
          Are you sure you want to remove <strong className="text-foreground">{server.name}</strong> from Vito? The server and its infrastructure will remain running on your cloud provider, but it will no longer be managed by Vito.
        </p>

        <Form id="delete-server-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="server-name">Confirm server name</Label>
              <Input id="server-name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>
          </FormFields>
        </Form>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button form="delete-server-form" variant="destructive" disabled={submitDisabled}>
            {form.processing && <LoaderCircleIcon className="size-4 animate-spin" />}
            Remove from Vito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
