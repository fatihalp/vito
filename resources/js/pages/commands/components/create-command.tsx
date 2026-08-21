import { FormEvent } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function CreateCommand({
  open,
  onOpenChange,
  serverId,
  siteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  siteId: number;
}) {
  const form = useForm<{
    name: string;
    command: string;
  }>({
    name: '',
    command: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('commands.store', { server: serverId, site: siteId }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create command</DialogTitle>
          <DialogDescription className="sr-only">Create a new command</DialogDescription>
        </DialogHeader>
        <Form id="create-command-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="command">Command</Label>
              <Textarea id="command" name="command" value={form.data.command} onChange={(e) => form.setData('command', e.target.value)} />
              <p className="text-muted-foreground text-sm">
                You can use variables like {'${VARIABLE_NAME}'} in the command. The variables will be asked when executing the command
              </p>
              <p className="text-muted-foreground text-sm">Using `php` command will use the site's php version.</p>
              <InputError message={form.errors.command} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <div className="flex items-center gap-2">
            <Button form="create-command-form" type="submit" disabled={form.processing}>
              {form.processing && <LoaderCircle className="animate-spin" />}
              Create
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
