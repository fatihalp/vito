import { useTranslate } from '@/hooks/use-translate';
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
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Project } from '@/types/project';
import { Form, FormField, FormFields } from '@/components/ui/form';

export default function ProjectForm({
  project,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  children,
}: {
  project?: Project;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const translateText = useTranslate();
  const [localOpen, setOpen] = useState(defaultOpen || false);
  const open = controlledOpen ?? localOpen;
  useEffect(() => {
    setOpen(defaultOpen || false);
  }, [defaultOpen]);

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (onOpenChange) {
      onOpenChange(open);
    }
  };

  const form = useForm({
    name: project?.name || '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();

    if (project) {
      form.patch(`/settings/projects/${project.id}`, {
        onSuccess() {
          handleOpenChange(false);
        },
      });
      return;
    }

    form.post('/settings/projects', {
      onSuccess() {
        handleOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? translateText("Edit Project") : translateText("Create Project")}</DialogTitle>
          <DialogDescription className="sr-only">{project ? translateText("Edit the project details.") : translateText("Here you can create a new project.")}</DialogDescription>
        </DialogHeader>
        <Form id="project-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="name">{translateText('Name')}</Label>
              <Input type="text" id="name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {translateText('Cancel')}
            </Button>
          </DialogClose>
          <Button form="project-form" type="button" onClick={submit} disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            {translateText('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
