import { useTranslate } from '@/hooks/use-translate';
import { useForm } from '@inertiajs/react';
import { type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, RocketIcon } from 'lucide-react';
import { Site } from '@/types/site';

export default function Deploy({ site, variant }: { site: Site; variant?: ComponentProps<typeof Button>['variant'] }) {
  const translateText = useTranslate();
  const form = useForm();
  const unavailable = site.is_proxied_site_type && (!site.port || !site.start_command);

  return (
    <Button
      variant={variant}
      disabled={form.processing || unavailable}
      aria-label={unavailable ? translateText('Configure a port and start command before deploying') : translateText('Deploy site')}
      title={unavailable ? translateText('Configure a port and start command before deploying') : undefined}
      onClick={() => form.post(`/servers/${site.server_id}/sites/${site.id}/deploy`)}
    >
      {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <RocketIcon />}
      {translateText(form.processing ? 'Deploying' : 'Deploy')}
    </Button>
  );
}
