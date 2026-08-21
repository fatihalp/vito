import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, RocketIcon } from 'lucide-react';
import { Site } from '@/types/site';

export default function Deploy({ site }: { site: Site }) {
  const form = useForm();
  const unavailable = site.is_proxied_site_type && (!site.port || !site.start_command);

  return (
    <Button
      disabled={form.processing || unavailable}
      aria-label={unavailable ? 'Configure a port and start command before deploying' : 'Deploy site'}
      title={unavailable ? 'Configure a port and start command before deploying' : undefined}
      onClick={() => form.post(route('application.deploy', { server: site.server_id, site: site.id }))}
    >
      {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <RocketIcon />}
      {form.processing ? 'Deploying' : 'Deploy'}
    </Button>
  );
}
