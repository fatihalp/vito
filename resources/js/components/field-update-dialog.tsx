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
import { useForm } from '@inertiajs/react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { LoaderCircleIcon } from 'lucide-react';

interface FieldUpdateDialogProps {
  title: string;
  description: string | ReactNode;
  initialValue: string;
  fieldName: string;
  routeName: string;
  routeParams: Record<string, any>;
  trigger: ReactNode;
  children: (form: any) => ReactNode;
}

export default function FieldUpdateDialog({
  title,
  description,
  initialValue,
  fieldName,
  routeName,
  routeParams,
  trigger,
  children,
}: FieldUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const form = useForm({
    [fieldName]: initialValue,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.patch(route(routeName, routeParams), {
      onSuccess: () => {
        setOpen(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={typeof description === 'string' && description === 'sr-only' ? 'sr-only' : undefined}>
            {description !== 'sr-only' ? description : "Update field"}
          </DialogDescription>
        </DialogHeader>

        <Form id={`${fieldName}-form`} onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>{children(form)}</FormField>
          </FormFields>
        </Form>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button form={`${fieldName}-form`} disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
