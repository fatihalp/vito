import { useTranslate } from '@/hooks/use-translate';
import { FormEvent } from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Redirect } from '@/types/redirect';
import RedirectFormFields, { RedirectForm } from './redirect-form-fields';

export default function EditRedirect({ open, onOpenChange, redirect }: { open: boolean; onOpenChange: (open: boolean) => void; redirect: Redirect }) {
  const translateText = useTranslate();
  const form = useForm<RedirectForm>({
    mode: String(redirect.mode),
    from: redirect.from,
    to: redirect.to,
    websocket: redirect.websocket,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.put(`/servers/${redirect.server_id}/sites/${redirect.site_id}/redirects/${redirect.id}`, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{translateText("Edit Redirect")}</DialogTitle>
          <DialogDescription className="sr-only">{translateText("Edit Redirect")}</DialogDescription>
        </DialogHeader>
        <Form className="p-4" id="edit-redirect-form" onSubmit={submit}>
          <RedirectFormFields form={form} />
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {translateText('Cancel')}
            </Button>
          </DialogClose>
          <Button form="edit-redirect-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            {translateText('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
