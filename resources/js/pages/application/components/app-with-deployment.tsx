import { useState } from 'react';
import { Deferred, Head, Link, usePage } from '@inertiajs/react';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import { Server } from '@/types/server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpenIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeXmlIcon,
  GitBranchIcon,
  Globe2Icon,
  Layers3Icon,
  ListEndIcon,
  LockKeyholeIcon,
  MoreHorizontalIcon,
  NetworkIcon,
  ServerIcon,
  UserRoundIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { SiteResource } from '@/types/site-resource';
import { HostedDomain } from '@/types/hosted-domain';
import { DNSProvider } from '@/types/dns-provider';
import SiteResourceDiagram from '@/pages/application/components/site-resource-diagram';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import DeploymentsTable from '@/pages/application/deployments/table';
import { DeploymentsSkeleton, SiteDetailsSkeleton, SiteResourceDiagramSkeleton, WorkersCronJobsSkeleton } from '@/components/page-skeleton';

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="break-words text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}

function StatusDetail({ icon: Icon, label, enabled }: { icon: LucideIcon; label: string; enabled: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
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
    resources?: SiteResource[];
    hostedDomains?: HostedDomain[];
    dnsProviders?: DNSProvider[];
    domainProxyStatus?: Record<string, boolean>;
  }>();
  const site = useRealtimeRecord<Site>(page.props.site, 'site')!;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <ServerLayout>
      <Head title={`${site.domain} - ${page.props.server.name}`} />

      <Container className="max-w-7xl gap-6">
        {site.status === 'installation_failed' && <SiteBanners site={site} />}

        <Deferred data={['resources', 'hostedDomains', 'dnsProviders', 'domainProxyStatus']} fallback={<SiteResourceDiagramSkeleton />}>
          <SiteResourceDiagram
            server={page.props.server}
            site={site}
            resources={page.props.resources || []}
            hostedDomains={page.props.hostedDomains || []}
            dnsProviders={page.props.dnsProviders || []}
            workersCount={page.props.overviewWorkersCount}
            cronJobsCount={page.props.overviewCronJobsCount}
            domainProxyStatus={page.props.domainProxyStatus || {}}
          />
        </Deferred>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {site.is_proxied_site_type && (
              <ProxiedAppCard site={site} initialWorker={page.props.worker} />
            )}

            <Deferred data={['deployments', 'deploymentScript']} fallback={<DeploymentsSkeleton />}>
              <section aria-labelledby="deployments-heading">
                <Card>
                  <CardHeader className="gap-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg text-lg font-semibold">
                          {site.domain.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h1 id="deployments-heading" className="sr-only">Application</h1>
                            <CardTitle>Deployments</CardTitle>
                            <Badge variant={site.status_color}>{site.status}</Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 flex min-w-0 items-center gap-2 text-sm">
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
                        {site.status !== 'installation_failed' && <SiteBanners site={site} compact />}
                        <Deploy site={site} />
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
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
                  </CardHeader>
                  <CardContent className="p-4">
                    <DeploymentsTable deployments={page.props.deployments} showPagination={false} />
                  </CardContent>
                  <CardFooter className="justify-end p-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={route('application.deployments.index', { server: site.server_id, site: site.id })}>View all deployments</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </section>
            </Deferred>

            <Deferred data={['overviewWorkers', 'overviewCronJobs']} fallback={<WorkersCronJobsSkeleton />}>
              <section className="grid gap-4 md:grid-cols-2" aria-label="Site automation">
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                        <ListEndIcon className="size-4" />
                      </div>
                      <div>
                        <CardTitle>Background processes</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">{page.props.overviewWorkersCount ?? 0} configured</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={route('workers.site', { server: site.server_id, site: site.id })}>Manage</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="divide-y p-0">
                    {page.props.overviewWorkers && page.props.overviewWorkers.length > 0 ? (
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
                      <p className="text-muted-foreground px-4 py-6 text-center text-sm">No background processes yet.</p>
                    )}
                    {(page.props.overviewWorkersCount ?? 0) > (page.props.overviewWorkers?.length ?? 0) && (
                      <p className="text-muted-foreground px-4 py-2 text-xs">Showing 3 of {page.props.overviewWorkersCount}</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                        <CalendarClockIcon className="size-4" />
                      </div>
                      <div>
                        <CardTitle>Scheduled jobs</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">{page.props.overviewCronJobsCount ?? 0} configured</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={route('cronjobs.site', { server: site.server_id, site: site.id })}>Manage</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="divide-y p-0">
                    {page.props.overviewCronJobs && page.props.overviewCronJobs.length > 0 ? (
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
                      <p className="text-muted-foreground px-4 py-6 text-center text-sm">No scheduled jobs yet.</p>
                    )}
                    {(page.props.overviewCronJobsCount ?? 0) > (page.props.overviewCronJobs?.length ?? 0) && (
                      <p className="text-muted-foreground px-4 py-2 text-xs">Showing 3 of {page.props.overviewCronJobsCount}</p>
                    )}
                  </CardContent>
                </Card>
              </section>
            </Deferred>
          </div>

          <Card className="overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="flex-row items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Layers3Icon className="size-4" />
              </div>
              <div className="flex flex-col gap-1">
                <CardTitle>Site details</CardTitle>
                <p className="text-muted-foreground text-sm">Runtime and connection information</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 p-4">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Connection</p>
                <Detail icon={ServerIcon} label="Server">
                  {page.props.server.name}
                </Detail>
                <Detail icon={NetworkIcon} label="Public IP">
                  <span className="font-mono">{page.props.server.ip}</span>
                </Detail>
              </div>

              <div className="flex flex-col gap-3 border-t p-4">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Runtime</p>
                <Detail icon={CodeXmlIcon} label="Site type">
                  {formatSiteType(site.type)}
                </Detail>
                {site.php_version && <Detail icon={CodeXmlIcon} label="PHP">{site.php_version}</Detail>}
              </div>

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleContent>
                  <div className="flex flex-col gap-3 border-t p-4">
                    <Detail icon={UserRoundIcon} label="Site user">
                      {site.user}
                    </Detail>
                    <Detail icon={Globe2Icon} label="Webserver">
                      {site.webserver}
                    </Detail>
                    {site.branch && <Detail icon={GitBranchIcon} label="Branch">{site.branch}</Detail>}
                  </div>
                  <div className="bg-muted/30 text-muted-foreground flex items-center justify-between gap-3 border-t px-4 py-3 text-xs">
                    <span>Server ID: {page.props.server.id}</span>
                    <span>Site ID: {site.id}</span>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="grid grid-cols-2 divide-x border-t">
                <StatusDetail icon={LockKeyholeIcon} label="SSL" enabled={site.ssl_enabled} />
                <StatusDetail icon={ZapIcon} label="Auto deploy" enabled={site.auto_deploy} />
              </div>

              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground w-full justify-center text-xs"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? (
                    <>
                      Hide details
                      <ChevronUpIcon className="ml-1.5 size-3.5" />
                    </>
                  ) : (
                    <>
                      More details
                      <ChevronDownIcon className="ml-1.5 size-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
