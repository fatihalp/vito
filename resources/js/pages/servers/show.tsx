import { Head, usePage } from '@inertiajs/react';

import { type Configs } from '@/types';
import { type Server } from '@/types/server';
import { type SecurityScore } from '@/types/security';
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
  securityScore?: SecurityScore;
};

export default function ShowServer() {
  const page = usePage<Response>();
  return (
    <ServerLayout>
      <Head title={`Overview - ${page.props.server.name}`} />

      {['installing', 'installation_failed'].includes(page.props.server.status) ? (
        <InstallingServer />
      ) : (
        <ServerOverview securityScore={page.props.securityScore} />
      )}
    </ServerLayout>
  );
}
