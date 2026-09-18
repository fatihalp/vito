import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';
import { StorageMigration } from '@/types/storage-migration';

export default function RenameStorageMigration({
  open,
  onOpenChange,
  storageMigration,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageMigration: StorageMigration;
}) {
  const form = useForm({ name: storageMigration.name ?? '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.patch(route('storage-migrations.update', { storageMigration: storageMigration.id }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Rename storage migration</DialogTitle>
          <DialogDescription className="sr-only">Rename storage migration</DialogDescription>
        </DialogHeader>
        <Form className="p-4" id="rename-storage-migration-form" onSubmit={submit}>
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button form="rename-storage-migration-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
