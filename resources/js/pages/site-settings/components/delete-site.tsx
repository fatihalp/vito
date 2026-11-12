import { FormEvent, ReactNode } from 'react';
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
import { Site } from '@/types/site';
import siteHelper from '@/lib/site-helper';
import { SharedData } from '@/types';

export default function DeleteSite({ site, children }: { site: Site; children: ReactNode }) {
  const page = usePage<SharedData>();
  const form = useForm({
    domain: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.delete(`/servers/${site.server_id}/sites/${site.id}/settings`, {
      onSuccess: () => {
        siteHelper.storeSite();
        if (page.props.auth.currentProject) {
          siteHelper.removeRecentSite(page.props.auth.user.id, page.props.auth.currentProject.id, site.server_id, site.id);
        }
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {site.domain}</DialogTitle>
          <DialogDescription className="sr-only">Delete site from Pure.</DialogDescription>
        </DialogHeader>

        <p className="p-4 text-sm text-muted-foreground">
          Are you sure you want to delete <strong className="text-foreground">{site.domain}</strong>? The site will be removed from Pure.
          Its files and physical server will remain untouched.
        </p>

        <Form id="delete-site-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="domain">Confirm domain name</Label>
              <Input id="domain" value={form.data.domain} onChange={(e) => form.setData('domain', e.target.value)} />
              <InputError message={form.errors.domain} />
            </FormField>
          </FormFields>
        </Form>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button form="delete-site-form" variant="destructive" disabled={form.processing || form.data.domain !== site.domain}>
            {form.processing && <LoaderCircleIcon className="size-4 animate-spin" />}
            Delete site
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
