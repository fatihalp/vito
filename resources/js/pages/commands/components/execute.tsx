import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';
import { Command } from '@/types/command';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';

export default function Execute({
  open,
  onOpenChange,
  command,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  command: Command;
}) {
  const form = useForm<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('commands.execute', { server: command.server_id, site: command.site_id, command: command.id }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Run {command.name}</DialogTitle>
          <DialogDescription>The output will open automatically and update live.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 p-4">
          <div className="bg-muted rounded-md border p-3 font-mono text-sm break-all whitespace-pre-wrap">{command.command}</div>
          <Form id="execute-command-form" onSubmit={submit}>
            <FormFields>
              {command.variables.map((variable: string) => (
                <FormField key={`variable-${variable}`}>
                  <Label htmlFor={variable}>{variable}</Label>
                  <Input id={variable} name={variable} value={form.data[variable] || ''} onChange={(e) => form.setData(variable, e.target.value)} />
                  <InputError message={form.errors[variable as keyof typeof form.errors]} />
                </FormField>
              ))}
            </FormFields>
          </Form>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button form="execute-command-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            Run command
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
