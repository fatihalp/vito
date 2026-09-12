import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import ServerLayout from '@/layouts/server/layout';
import SiteResourceDiagram from '@/pages/application/components/site-resource-diagram';
import type { DNSProvider } from '@/types/dns-provider';
import type { HostedDomain } from '@/types/hosted-domain';
import type { Server } from '@/types/server';
import type { Site } from '@/types/site';
import type { SiteResource } from '@/types/site-resource';
import { Head, usePage } from '@inertiajs/react';
import { useRealtimeRecord } from '@/hooks/use-socket-events';

export default function SiteTopology() {
  const page = usePage<{
    server: Server;
    site: Site;
    resources: SiteResource[];
    hostedDomains: HostedDomain[];
    dnsProviders: DNSProvider[];
    domainProxyStatus: Record<string, boolean>;
    overviewWorkersCount: number;
    overviewCronJobsCount: number;
  }>();

  const site = useRealtimeRecord<Site>(page.props.site, 'site')!;

  return (
    <ServerLayout>
      <Head title={`Topology - ${site.domain}`} />
      <Container className="max-w-7xl gap-6">
        <HeaderContainer>
          <Heading
            title="Infrastructure Topology"
            description="Interactive diagram of domain routing, runtime environment, connected databases, cache, storage, and background workers."
          />
          {site.status !== 'installation_failed' && <SiteBanners site={site} compact />}
        </HeaderContainer>

        {site.status === 'installation_failed' && <SiteBanners site={site} />}

        <SiteResourceDiagram
          server={page.props.server}
          site={site}
          resources={page.props.resources || []}
          hostedDomains={page.props.hostedDomains || []}
          dnsProviders={page.props.dnsProviders || []}
          workersCount={page.props.overviewWorkersCount}
          cronJobsCount={page.props.overviewCronJobsCount}
          domainProxyStatus={page.props.domainProxyStatus || {}}
          defaultOpen={true}
        />
      </Container>
    </ServerLayout>
  );
}
