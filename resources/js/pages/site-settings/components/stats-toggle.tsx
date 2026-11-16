import { useTranslate } from '@/hooks/use-translate';
import { Site } from '@/types/site';
import { ReactNode, useState } from 'react';
import { useForm } from '@inertiajs/react';
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
import { LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';

export default function StatsToggle({ site, children }: { site: Site; children: ReactNode }) {
  const translateText = useTranslate();
  const [open, setOpen] = useState(false);
  const enabled = site.stats_enabled;
  const form = useForm({ enabled: !enabled });

  const submit = () => {
    form.post(`/servers/${site.server_id}/sites/${site.id}/settings/toggle-stats`, {
      preserveScroll: true,
      onSuccess: () => setOpen(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{enabled ? translateText("Disable statistics") : translateText("Enable statistics")}</DialogTitle>
          <DialogDescription className="sr-only">{enabled ? translateText("Disable") : translateText("Enable")} {translateText("site statistics")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 p-4 text-sm">
          {enabled ? (
            <p>
              {translateText("This stops processing logs for")} <span className="font-medium">{site.domain}</span> {translateText('and')}{' '}
              <span className="font-medium">{translateText("permanently erases all historical statistics")}</span> {translateText("for this site. This cannot be undone.")}
            </p>
          ) : (
            <p>
              {translateText("Statistics collection will resume for")} <span className="font-medium">{site.domain}</span> {translateText("from now on. Previous history is not recovered.")}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{translateText('Cancel')}</Button>
          </DialogClose>
          <Button variant={enabled ? 'destructive' : 'default'} disabled={form.processing} onClick={submit}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            {enabled ? translateText("Disable") : translateText("Enable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
