import { useCallback, useEffect, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import type { InertiaTableData } from '@forjedio/inertia-table-react';
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, XIcon } from 'lucide-react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import LogOutput from '@/components/log-output';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLogContent } from '@/hooks/use-log-content';
import { useSocketListener } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import Deploy from '@/pages/application/components/deploy';
import DeploymentProgress from '@/pages/application/deployments/progress';
import DeploymentsTable from '@/pages/application/deployments/table';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';

export default function DeploymentsIndex() {
  const page = usePage<{
    server: Server;
    site: Site;
    deployments: InertiaTableData;
    activeDeployment: Deployment | null;
  }>();

  const { server, site } = page.props;
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(page.props.activeDeployment ?? null);
  const [showLog, setShowLog] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setActiveDeployment(page.props.activeDeployment ?? null);
    if (page.props.activeDeployment) {
      setDismissed(false);
    }
  }, [page.props.activeDeployment]);

  useSocketListener(
    useCallback(
      (event) => {
        if (event.type === 'deployment.created') {
          const created = event.data as Deployment;
          if (created.site_id === site.id) {
            setActiveDeployment(created);
            setDismissed(false);
          }
        } else if (event.type === 'deployment.updated') {
          const updated = event.data as Deployment;
          if (updated.site_id === site.id) {
            setActiveDeployment((prev) => (prev && prev.id === updated.id ? updated : prev ?? (updated.status === 'deploying' ? updated : null)));
          }
        }
      },
      [site.id],
    ),
  );

  const { content, step, isLoading } = useLogContent({
    serverId: server.id,
    logId: activeDeployment?.log?.id ?? activeDeployment?.log_id ?? 0,
    enabled: !!activeDeployment && !dismissed,
  });

  return (
    <ServerLayout>
      <Head title={`Deployments - ${site.domain}`} />
      <Container className="max-w-7xl flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Heading title="Deployments" description={`Complete deployment history for ${site.domain}.`} />
          <Deploy site={site} />
        </div>

        {activeDeployment && !dismissed && (
          <div className="flex flex-col gap-3">
            <DeploymentProgress
              deployment={activeDeployment}
              step={step}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                    onClick={() => setShowLog((prev) => !prev)}
                  >
                    {showLog ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
                    <span>{showLog ? 'Hide log' : 'Show log'}</span>
                  </Button>

                  <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs cursor-pointer">
                    <Link href={`/servers/${server.id}/sites/${site.id}/deployments/${activeDeployment.id}`}>
                      <span>Details</span>
                      <ExternalLinkIcon className="size-3.5" />
                    </Link>
                  </Button>

                  {activeDeployment.status !== 'deploying' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 cursor-pointer"
                      onClick={() => setDismissed(true)}
                      aria-label="Dismiss"
                      title="Dismiss"
                    >
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </div>
              }
            />

            {showLog && (
              <Card className="overflow-hidden border">
                <LogOutput className="h-64 w-full rounded-none border-0 p-4 font-mono text-xs">
                  {isLoading && 'Loading deployment output...'}
                  {!isLoading && (content || (activeDeployment.status === 'deploying' ? 'Waiting for output...' : 'No output was recorded.'))}
                </LogOutput>
              </Card>
            )}
          </div>
        )}

        <DeploymentsTable deployments={page.props.deployments} />
      </Container>
    </ServerLayout>
  );
}
