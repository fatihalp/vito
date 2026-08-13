import { Head, Link, router, usePage } from '@inertiajs/react';

import { type Configs } from '@/types';

import { VitoTable } from '@/components/vito-table';
import Heading from '@/components/heading';
import CreateServer from '@/pages/servers/components/create-server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import Layout from '@/layouts/app/layout';
import { BookOpenIcon, EyeIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';

type Page = {
  servers: InertiaTableData;
  public_key: string;
  configs: Configs;
};

const formatPercent = (value: unknown) => (typeof value === 'number' ? `${value.toFixed(1)}%` : '-');

const performanceCell = ({ row, value }: CellRenderProps) => {
  const performance = row.performance as { label: string; color: 'gray' | 'success' | 'info' | 'warning' | 'danger'; stale: boolean };

  if (value === null || value === undefined) {
    return <Badge variant={performance.color}>{performance.label}</Badge>;
  }

  const score = Number(value);
  if (performance.stale) {
    return (
      <div className="flex min-w-52 flex-col gap-1.5 py-1">
        <Badge variant={performance.color} className="w-fit">
          {performance.label}
        </Badge>
        <span className="text-muted-foreground text-xs">No fresh sample in the last 5 minutes</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-52 flex-col gap-1.5 py-1">
      <Badge variant={performance.color} className="w-fit">
        {performance.label} · {score.toFixed(1)}
      </Badge>
      <span className="text-muted-foreground text-xs tabular-nums">
        CPU {formatPercent(row.cpu_usage_percent)} · RAM {formatPercent(row.memory_used_percent)} · Disk {formatPercent(row.disk_used_percent)}
      </span>
    </div>
  );
};

export default function Servers() {
  const page = usePage<Page>();

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.reload({ only: ['servers'], preserveScroll: true });
      }
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <Layout>
      <Head title="Servers" />

      <Container className="max-w-7xl">
        <div className="flex items-start justify-between">
          <Heading title="Servers" description="Latest server resource pressure, with slow or stale servers shown first." />
          <div className="flex items-center gap-2">
            <a href="https://vitodeploy.com/docs/servers/create" target="_blank">
              <Button variant="outline">
                <BookOpenIcon />
                <span className="hidden lg:block">Docs</span>
              </Button>
            </a>
            <CreateServer>
              <Button>
                <PlusIcon />
                Create server
              </Button>
            </CreateServer>
          </div>
        </div>
        <VitoTable
          tableData={page.props.servers}
          cellRenderers={{ performance_score: performanceCell }}
          actions={(row: Row) => {
            const warnings = (row.warnings as Array<{ key: string }>) ?? [];
            const count = warnings.length;
            return (
              <div className="flex items-center justify-end gap-2">
                {count > 0 && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-warning/15 text-warning border-warning/40 flex cursor-default items-center gap-1.5 rounded-md border px-2 py-1.5">
                          <TriangleAlertIcon className="h-4 w-4" />
                          <span className="text-xs font-semibold">{count}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {count} {count === 1 ? 'warning' : 'warnings'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Link href={route('servers.show', { server: row.id })} prefetch>
                  <Button variant="outline" size="sm">
                    <EyeIcon />
                  </Button>
                </Link>
              </div>
            );
          }}
        />
      </Container>
    </Layout>
  );
}
