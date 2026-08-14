import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';
import { FormEvent, useEffect } from 'react';
import InputError from '@/components/ui/input-error';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useInputFocus } from '@/stores/useInputFocus';

export default function ConnectCredentialsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const setFocused = useInputFocus((state) => state.setFocused);

  useEffect(() => {
    setFocused(open);
    return () => setFocused(false);
  }, [open, setFocused]);

  const form = useForm<{ access_key: string; secret_key: string }>({
    access_key: '',
    secret_key: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('buckets.credentials.store'), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Connect Hetzner Object Storage</DialogTitle>
          <DialogDescription className="sr-only">Connect your Hetzner Object Storage access key</DialogDescription>
        </DialogHeader>
        <Form id="connect-bucket-credentials-form" onSubmit={submit} className="p-4">
          <FormFields>
            <Alert>
              <AlertDescription>
                Generate a key pair in the Hetzner Console under Object Storage → Access Keys. The key pair is valid for every bucket in the
                project, including ones created here later.
              </AlertDescription>
            </Alert>
            <FormField>
              <Label htmlFor="access_key">Access key</Label>
              <Input
                id="access_key"
                autoComplete="off"
                value={form.data.access_key}
                onChange={(e) => form.setData('access_key', e.target.value)}
              />
              <InputError message={form.errors.access_key} />
            </FormField>
            <FormField>
              <Label htmlFor="secret_key">Secret key</Label>
              <Input
                id="secret_key"
                type="password"
                autoComplete="new-password"
                value={form.data.secret_key}
                onChange={(e) => form.setData('secret_key', e.target.value)}
              />
              <InputError message={form.errors.secret_key} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button form="connect-bucket-credentials-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
