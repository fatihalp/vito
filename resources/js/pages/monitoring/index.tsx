import { Head, Link, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { TriangleAlertIcon } from 'lucide-react';
import Container from '@/components/container';
import MetricsCards from '@/pages/monitoring/components/metrics-cards';
import SystemStatus from '@/pages/monitoring/components/system-status';
import MemoryDiskDetails from '@/pages/monitoring/components/memory-disk-details';
import Filter, { useMetricsFilter } from '@/pages/monitoring/components/filter';
import Actions from '@/pages/monitoring/components/actions';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Monitoring() {
  const page = usePage<{
    server: Server;
    hasMonitoringService: boolean;
  }>();

  const [filter, setFilter] = useMetricsFilter();

  return (
    <ServerLayout>
      <Head title={`Monitoring - ${page.props.server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading title="Monitoring" description="Here you can see your server's metrics" />
          <div className="flex items-center gap-2">
            <Filter value={filter} onValueChange={setFilter} />
            <Actions server={page.props.server} />
          </div>
        </HeaderContainer>

        {!page.props.hasMonitoringService && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              <p>
                To monitor your server, you need to first install a{' '}
                <Link href={`/servers/${page.props.server.id}/services`} className="font-bold underline">
                  monitoring service
                </Link>
                .
              </p>
            </AlertDescription>
          </Alert>
        )}

        {page.props.hasMonitoringService && <SystemStatus server={page.props.server} filter={filter} />}

        <MetricsCards server={page.props.server} filter={filter} />

        <MemoryDiskDetails server={page.props.server} filter={filter} />
      </Container>
    </ServerLayout>
  );
}
