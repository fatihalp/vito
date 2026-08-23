import { useCallback, useEffect, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CircleIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import type { InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Server } from '@/types/server';
import { Service } from '@/types/service';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import Container from '@/components/container';
import { VitoTable } from '@/components/vito-table';
import { asRow } from '@/lib/inertia-table';
import InstallService from '@/pages/services/components/install';
import ServiceActions from '@/pages/services/components/service-actions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type LiveStatus = {
  state: string;
  color: 'success' | 'danger' | 'warning' | 'gray';
};

type Page = {
  server: Server;
  services: InertiaTableData;
  refreshing: boolean;
};

const STATE_LABELS: Record<string, string> = {
  active: 'Running',
  inactive: 'Stopped',
  failed: 'Failed',
  activating: 'Activating',
  deactivating: 'Deactivating',
  reloading: 'Reloading',
  unknown: 'Unknown',
};

const COLOR_CLASSES: Record<string, string> = {
  success: 'text-green-500',
  danger: 'text-red-500',
  warning: 'text-yellow-500',
  gray: 'text-gray-400',
};

function LiveStatusBadge({ serviceId, liveStatuses }: { serviceId: number; liveStatuses: Record<number, LiveStatus> }) {
  const status = liveStatuses[serviceId];

  if (!status) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleIcon className="size-2 animate-pulse fill-gray-400 text-gray-400" />
        <span>…</span>
      </span>
    );
  }

  const label = STATE_LABELS[status.state] ?? status.state;
  const colorClass = COLOR_CLASSES[status.color] ?? COLOR_CLASSES.gray;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', colorClass)}>
          <CircleIcon className="size-2 fill-current" />
          <span>{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          systemctl:{' '}
          <code className="font-mono">{status.state}</code>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ServicesIndex() {
  const page = usePage<Page>();
  const { server, services, refreshing } = page.props;

  const form = useForm({});
  const [liveStatuses, setLiveStatuses] = useState<Record<number, LiveStatus>>({});

  const fetchLiveStatuses = useCallback(async () => {
    try {
      const res = await fetch(route('services.live-statuses', { server: server.id }), {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (res.ok) {
        const data = await res.json();
        setLiveStatuses(data);
      }
    } catch {
      // silently ignore
    }
  }, [server.id]);

  useEffect(() => {
    fetchLiveStatuses();
    const interval = setInterval(fetchLiveStatuses, 10_000);
    return () => clearInterval(interval);
  }, [fetchLiveStatuses]);

  useEffect(() => {
    if (!refreshing) return;
    const interval = setInterval(() => router.reload(), 5000);
    return () => clearInterval(interval);
  }, [refreshing]);

  const refresh = () => {
    form.post(route('services.refresh', { server: server.id }), { preserveScroll: true });
  };

  const busy = refreshing || form.processing;

  return (
    <ServerLayout>
      <Head title={`Services - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Services" description="Here you can manage server's services" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={refresh} disabled={busy}>
              <RefreshCwIcon className={cn(busy && 'animate-spin')} />
              <span className="hidden lg:block">Refresh</span>
            </Button>
            <InstallService>
              <Button>
                <PlusIcon />
                <span className="hidden lg:block">Install</span>
              </Button>
            </InstallService>
          </div>
        </HeaderContainer>

        <VitoTable
          tableData={services}
          actions={(row: Row) => {
            const service = asRow<{ resource: Service }>(row, ['resource']).resource;
            return (
              <div className="flex items-center gap-3">
                <ServiceActions service={service} />
                <LiveStatusBadge serviceId={service.id} liveStatuses={liveStatuses} />
              </div>
            );
          }}
        />
      </Container>
    </ServerLayout>
  );
}
