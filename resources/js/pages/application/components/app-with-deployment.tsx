import { Head, Link, usePage } from '@inertiajs/react';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import { Server } from '@/types/server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpenIcon,
  CalendarClockIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  ListEndIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DeploymentScript from '@/pages/application/components/deployment-script';
import Env from '@/pages/application/components/env';
import Deploy from '@/pages/application/components/deploy';
import AutoDeployment from '@/pages/application/components/auto-deployment';
import { DeploymentScript as DeploymentScriptType } from '@/types/deployment-script';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import type { InertiaTableData } from '@forjedio/inertia-table-react';

import SiteBanners from '@/components/site-banners';
import ProxiedAppCard from '@/pages/application/components/proxied-app-card';
import { Worker } from '@/types/worker';
import { CronJob } from '@/types/cronjob';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DeploymentsTable from '@/pages/application/deployments/table';

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function formatSiteType(type: string): string {
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AppWithDeployment() {
  const page = usePage<{
    server: Server;
    site: Site;
    deployments: InertiaTableData;
    deploymentScript: DeploymentScriptType;
    buildScript?: DeploymentScriptType;
    preFlightScript?: DeploymentScriptType;
    worker: Worker | null;
    overviewWorkers: Worker[];
    overviewWorkersCount: number;
    overviewCronJobs: CronJob[];
    overviewCronJobsCount: number;
  }>();
  const site = useRealtimeRecord<Site>(page.props.site, 'site')!;

  return (
    <ServerLayout>
      <Head title={`${site.domain} - ${page.props.server.name}`} />

      <Container className="max-w-7xl gap-6">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-semibold">
              {site.domain.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-xl font-semibold">{site.domain}</h1>
                <Badge variant={site.status_color}>{site.status}</Badge>
              </div>
              <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
                {site.repository ? (
                  <>
                    <GitBranchIcon className="size-4 shrink-0" />
                    <span className="truncate">{site.repository}</span>
                    {site.branch && <span className="shrink-0">· {site.branch}</span>}
                  </>
                ) : (
                  <span>{formatSiteType(site.type)} site</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" asChild>
              <a href={site.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon />
                Visit
              </a>
            </Button>
            <Deploy site={site} />
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href="https://vitodeploy.com/docs/sites/application" target="_blank" rel="noopener noreferrer">
                    <BookOpenIcon />
                    Documentation
                  </a>
                </DropdownMenuItem>
                <AutoDeployment site={site}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!site.source_control_id}>
                    {site.auto_deploy ? 'Disable' : 'Enable'} auto deploy
                  </DropdownMenuItem>
                </AutoDeployment>
                {!site.modern_deployment && (
                  <DeploymentScript site={site} script={page.props.deploymentScript} description="This script will be executed on every deployment.">
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Deployment Script</DropdownMenuItem>
                  </DeploymentScript>
                )}
                {page.props.buildScript && site.modern_deployment && (
                  <DeploymentScript
                    site={site}
                    script={page.props.buildScript}
                    description="This script will build resources like composer and npm before release"
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Build Script</DropdownMenuItem>
                  </DeploymentScript>
                )}
                {page.props.preFlightScript && site.modern_deployment && (
                  <DeploymentScript
                    site={site}
                    script={page.props.preFlightScript}
                    description="This script will be executed before release like migrations and optimizations"
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Pre Flight Script</DropdownMenuItem>
                  </DeploymentScript>
                )}
                <Env site={site}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>Update .env</DropdownMenuItem>
                </Env>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <SiteBanners site={site} />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {site.is_proxied_site_type && (
              <ProxiedAppCard site={site} initialWorker={page.props.worker} />
            )}

            <section className="flex flex-col gap-3" aria-labelledby="deployments-heading">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="deployments-heading" className="font-semibold">Deployments</h2>
                  <p className="text-muted-foreground text-sm">Your three most recent deployments.</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={route('application.deployments.index', { server: site.server_id, site: site.id })}>View all</Link>
                </Button>
              </div>
              <DeploymentsTable deployments={page.props.deployments} showPagination={false} />
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ListEndIcon className="text-muted-foreground size-4" />
                    <CardTitle>Background processes</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={route('workers.site', { server: site.server_id, site: site.id })}>Manage</Link>
                  </Button>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {page.props.overviewWorkers.length > 0 ? (
                    page.props.overviewWorkers.map((worker) => (
                      <div key={worker.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{worker.name || worker.command}</p>
                          <p className="text-muted-foreground truncate">{worker.command}</p>
                        </div>
                        <Badge variant={worker.status_color}>{worker.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground px-4 py-8 text-center text-sm">No background processes yet.</p>
                  )}
                  {page.props.overviewWorkersCount > page.props.overviewWorkers.length && (
                    <p className="text-muted-foreground px-4 py-2 text-xs">Showing 3 of {page.props.overviewWorkersCount}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CalendarClockIcon className="text-muted-foreground size-4" />
                    <CardTitle>Scheduled jobs</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={route('cronjobs.site', { server: site.server_id, site: site.id })}>Manage</Link>
                  </Button>
                </CardHeader>
                <CardContent className="divide-y p-0">
                  {page.props.overviewCronJobs.length > 0 ? (
                    page.props.overviewCronJobs.map((cronJob) => (
                      <div key={cronJob.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{cronJob.name || cronJob.command}</p>
                          <p className="text-muted-foreground truncate">{cronJob.frequency}</p>
                        </div>
                        <Badge variant={cronJob.status_color}>{cronJob.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground px-4 py-8 text-center text-sm">No scheduled jobs yet.</p>
                  )}
                  {page.props.overviewCronJobsCount > page.props.overviewCronJobs.length && (
                    <p className="text-muted-foreground px-4 py-2 text-xs">Showing 3 of {page.props.overviewCronJobsCount}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle>Site details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4">
                <Detail label="Server">{page.props.server.name}</Detail>
                <Detail label="Public IP">{page.props.server.ip}</Detail>
                <Detail label="Site type">{formatSiteType(site.type)}</Detail>
                {site.php_version && <Detail label="PHP">{site.php_version}</Detail>}
                <Detail label="Site user">{site.user}</Detail>
                <Detail label="Webserver">{site.webserver}</Detail>
                {site.branch && <Detail label="Branch">{site.branch}</Detail>}
                <Detail label="SSL">
                  <Badge variant={site.ssl_enabled ? 'success' : 'outline'}>{site.ssl_enabled ? 'Enabled' : 'Disabled'}</Badge>
                </Detail>
                <Detail label="Auto deploy">
                  <Badge variant={site.auto_deploy ? 'success' : 'outline'}>{site.auto_deploy ? 'Enabled' : 'Disabled'}</Badge>
                </Detail>
                <Detail label="Server ID">{page.props.server.id}</Detail>
                <Detail label="Site ID">{site.id}</Detail>
              </dl>
            </CardContent>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
