import { useTranslate } from '@/hooks/use-translate';
import { Head, usePage } from '@inertiajs/react';

import { type Configs } from '@/types';
import { type Server } from '@/types/server';
import InstallingServer from '@/pages/servers/installing';
import ServerOverview from '@/pages/servers/overview';
import ServerLayout from '@/layouts/server/layout';

type Response = {
  servers: {
    data: Server[];
  };
  server: Server;
  public_key: string;
  configs: Configs;
};

export default function ShowServer() {
  const translateText = useTranslate();
  const page = usePage<Response>();
  return (
    <ServerLayout>
      <Head title={translateText("Overview - :value", { value: page.props.server.name })} />

      {['installing', 'installation_failed'].includes(page.props.server.status) ? (
        <InstallingServer />
      ) : (
        <ServerOverview />
      )}
    </ServerLayout>
  );
}
