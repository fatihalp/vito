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
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';

import { useDialog } from '@/hooks/use-dialog';
import { SparklesIcon } from 'lucide-react';

type CreateForm = {
  name: string;
};

export default function CreateWorkflow({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialog = useDialog();

  const form = useForm<CreateForm>({
    name: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('workflows.store'), {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  };

  const openTemplates = () => {
    setOpen(false);
    dialog.workflowTemplates.open({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription className="sr-only">Create new Workflow</DialogDescription>
        </DialogHeader>
        <Form className="p-4" id="create-workflow-form" onSubmit={submit}>
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input type="text" id="name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            <div className="bg-muted/30 rounded-lg border border-dashed p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-foreground flex items-center gap-1.5 text-xs font-medium">
                    <SparklesIcon className="text-primary size-3.5" />
                    Standard Laravel Templates
                  </div>
                  <p className="text-muted-foreground text-[11px]">Create complete Single Server or Microservices workflows in one click.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={openTemplates} className="shrink-0 text-xs">
                  Browse Templates
                </Button>
              </div>
            </div>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
