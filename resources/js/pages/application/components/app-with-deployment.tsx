import { useTranslate } from '@/hooks/use-translate';
import { useCallback, useEffect, useState } from 'react';
import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import { Site } from '@/types/site';
import ServerLayout from '@/layouts/server/layout';
import { Server } from '@/types/server';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangleIcon, CalendarClockIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon, CodeXmlIcon, CopyIcon, ExternalLinkIcon, FileCode2Icon, GitBranchIcon, ListEndIcon, LockKeyholeIcon, NetworkIcon, ServerIcon, SettingsIcon, TerminalIcon, XIcon, type LucideIcon } from 'lucide-react';
import Deploy from '@/pages/application/components/deploy';
import DeploymentScript from '@/pages/application/components/deployment-script';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DeploymentScript as DeploymentScriptType } from '@/types/deployment-script';
import { useRealtimeRecord, useSocketListener } from '@/hooks/use-socket-events';
import type { InertiaTableData } from '@forjedio/inertia-table-react';

import SiteBanners from '@/components/site-banners';
import ProxiedAppCard from '@/pages/application/components/proxied-app-card';
import { Worker } from '@/types/worker';
import { CronJob } from '@/types/cronjob';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import DeploymentsTable from '@/pages/application/deployments/table';
import DeploymentProgress from '@/pages/application/deployments/progress';
import { useLogContent } from '@/hooks/use-log-content';
import { useClipboard } from '@/hooks/use-clipboard';
import LogOutput from '@/components/log-output';
import { Deployment, LatestCommit } from '@/types/deployment';
import LatestCommitBanner from '@/pages/application/components/latest-commit-banner';
import { DeploymentsSkeleton, WorkersCronJobsSkeleton } from '@/components/page-skeleton';

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium">
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">
        {label && <p className="text-muted-foreground text-xs">{label}</p>}
        {children}
      </div>
    </div>
  );
}

function formatSiteType(type?: string): string {
  if (!type) return '';
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AppWithDeployment() {
  const translateText = useTranslate();
  const page = usePage<{
    server: Server;
    site: Site;
    deployments: InertiaTableData;
    activeDeployment?: Deployment | null;
    repositoryUrl: string | null;
    latestCommit?: LatestCommit | null;
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
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(page.props.activeDeployment ?? null);
  const [showLog, setShowLog] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [togglingAutoDeploy, setTogglingAutoDeploy] = useState(false);
  const { copied: copiedIp, copy: copyIp } = useClipboard();

  const fallbackScript = (name: string): DeploymentScriptType => ({
    id: 0,
    site_id: site.id,
    name,
    content: '',
    configs: { restart_workers: false },
    created_at: '',
    updated_at: '',
  });

  const handleToggleAutoDeploy = () => {
    if (!site.source_control_id || togglingAutoDeploy) return;
    setTogglingAutoDeploy(true);
    const url = site.auto_deploy
      ? `/servers/${site.server_id}/sites/${site.id}/disable-auto-deployment`
      : `/servers/${site.server_id}/sites/${site.id}/enable-auto-deployment`;
    router.post(
      url,
      {},
      {
        preserveScroll: true,
        onFinish: () => setTogglingAutoDeploy(false),
      },
    );
  };

  useEffect(() => {
    if (page.props.activeDeployment) {
      setActiveDeployment(page.props.activeDeployment);
      setDismissed(false);
    } else {
      setActiveDeployment((prev) => (prev && prev.site_id === site.id && prev.status !== 'deploying' ? prev : null));
    }
  }, [page.props.activeDeployment, site.id]);

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
    serverId: page.props.server.id,
    logId: activeDeployment?.log?.id ?? activeDeployment?.log_id ?? 0,
    enabled: !!activeDeployment && !dismissed,
  });

  return (
    <ServerLayout>
      <Head title={`${site.domain} - ${page.props.server.name}`} />

      <Container className="gap-4">
        {site.status === 'installation_failed' && <SiteBanners site={site} includeAppDebug />}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {site.is_proxied_site_type && (
              <ProxiedAppCard site={site} initialWorker={page.props.worker} />
            )}

            <Deferred data="deployments" fallback={<DeploymentsSkeleton />}>
              <section aria-label={translateText('Deployments')}>
                <Card>
                  <CardHeader className="gap-3 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
                        {site.repository ? (
                          <>
                            {page.props.repositoryUrl ? (
                              <a
                                href={page.props.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground inline-flex min-w-0 items-center gap-1.5 font-medium hover:underline"
                                title={translateText('Open repository')}
                              >
                                <span className="truncate">{site.repository}</span>
                                <ExternalLinkIcon className="size-3.5 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-foreground truncate font-medium">{site.repository}</span>
                            )}
                            {site.branch && (
                              <Badge variant="outline" className="shrink-0 gap-1 font-mono font-normal">
                                <GitBranchIcon className="size-3" />
                                {site.branch}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span>{formatSiteType(site.type)} site</span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {site.status !== 'installation_failed' && <SiteBanners site={site} compact includeAppDebug />}
                        <Deploy site={site} />
                        {site.modern_deployment ? (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="gap-1.5 cursor-pointer">
                                <TerminalIcon className="size-4" />
                                <span>{translateText('Scripts')}</span>
                                <ChevronDownIcon className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DeploymentScript
                                site={site}
                                script={page.props.buildScript ?? fallbackScript('build')}
                                description={translateText('This script will build resources like composer and npm before release')}
                              >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  {translateText('Build Script')}
                                </DropdownMenuItem>
                              </DeploymentScript>
                              <DeploymentScript
                                site={site}
                                script={page.props.preFlightScript ?? fallbackScript('pre-flight')}
                                description={translateText('This script will be executed before release like migrations and optimizations')}
                              >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  {translateText('Pre Flight Script')}
                                </DropdownMenuItem>
                              </DeploymentScript>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <DeploymentScript
                            site={site}
                            script={page.props.deploymentScript ?? fallbackScript('default')}
                            description={translateText('This script will be executed on every deployment.')}
                          >
                            <Button variant="outline" className="gap-1.5 cursor-pointer">
                              <TerminalIcon className="size-4" />
                              <span>{translateText('Script')}</span>
                            </Button>
                          </DeploymentScript>
                        )}
                        <Button variant="outline" asChild className="gap-1.5 cursor-pointer">
                          <Link href={`/servers/${page.props.server.id}/sites/${site.id}/environment`}>
                            <FileCode2Icon className="size-4" />
                            <span>{translateText('Env')}</span>
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <Deferred data="latestCommit" fallback={<></>}>
                    <LatestCommitBanner site={site} latestCommit={page.props.latestCommit} activeDeployment={activeDeployment} />
                  </Deferred>
                  {activeDeployment && !dismissed && (
                    <div className="border-t p-4 flex flex-col gap-3">
                      {activeDeployment.is_duplicate && (
                        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                          <AlertTriangleIcon className="size-4 shrink-0" />
                          <span>
                            {translateText('This commit (:commit) has already been deployed in a previous release.', { commit: activeDeployment.commit_id_short || activeDeployment.commit_id || '' })}
                          </span>
                        </div>
                      )}
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
                              <span>{showLog ? translateText("Hide log") : translateText("Show log")}</span>
                            </Button>

                            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs cursor-pointer">
                              <Link href={`/servers/${page.props.server.id}/sites/${site.id}/deployments/${activeDeployment.id}`}>
                                <span>{translateText('Details')}</span>
                                <ExternalLinkIcon className="size-3.5" />
                              </Link>
                            </Button>

                            {activeDeployment.status !== 'deploying' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 cursor-pointer"
                                onClick={() => setDismissed(true)}
                                title={translateText('Dismiss')}
                              >
                                <XIcon className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        }
                      />

                      {showLog && (
                        <Card className="overflow-hidden border">
                          <LogOutput className="h-64 w-full rounded-none border-0 p-4 font-mono text-xs">
                            {isLoading && translateText("Loading deployment output...")}
                            {!isLoading && (content || (activeDeployment.status === 'deploying' ? translateText("Waiting for output...") : translateText("No output was recorded.")))}
                          </LogOutput>
                        </Card>
                      )}
                    </div>
                  )}
                  <CardContent className="p-0 border-t">
                    <DeploymentsTable deployments={page.props.deployments} showPagination={false} modal />
                  </CardContent>
                  <CardFooter className="justify-end border-t p-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/servers/${site.server_id}/sites/${site.id}/deployments`}>{translateText("All")}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </section>
            </Deferred>

            <Deferred data={['overviewWorkers', 'overviewCronJobs']} fallback={<WorkersCronJobsSkeleton />}>
              <section className="grid gap-4 md:grid-cols-2" aria-label={translateText('Site automation')}>
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg">
                        <ListEndIcon className="size-4" />
                      </div>
                      <div>
                        <CardTitle>{translateText("Background processes")}</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">{page.props.overviewWorkersCount ?? 0} {translateText('configured')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link href={`/servers/${site.server_id}/sites/${site.id}/workers`} aria-label={translateText('Manage services')}>
                        <SettingsIcon className="size-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="divide-y p-0">
                    {page.props.overviewWorkers && page.props.overviewWorkers.length > 0 ? (
                      page.props.overviewWorkers?.map((worker) => (
                        <div key={worker.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{worker.name || worker.command}</p>
                            <p className="text-muted-foreground truncate">{worker.command}</p>
                          </div>
                          <Badge variant={worker.status_color}>{worker.status}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground px-4 py-6 text-center text-sm">{(page.props.overviewWorkersCount ?? 0) > 0 ? <Link className="underline" href={`/servers/${site.server_id}/sites/${site.id}/resources`}>{translateText('Linked background processes are listed under Resources.')}</Link> : translateText('No background processes yet.')}</p>
                    )}
                    {(page.props.overviewWorkersCount ?? 0) > (page.props.overviewWorkers?.length ?? 0) && (
                      <p className="text-muted-foreground px-4 py-2 text-xs">{translateText('Showing :shown of :total', { shown: page.props.overviewWorkers?.length ?? 0, total: page.props.overviewWorkersCount })}</p>
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
                        <CardTitle>{translateText("Scheduled jobs")}</CardTitle>
                        <p className="text-muted-foreground mt-1 text-xs">{page.props.overviewCronJobsCount ?? 0} {translateText('configured')}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <Link href={`/servers/${site.server_id}/sites/${site.id}/cronjobs`} aria-label={translateText('Manage jobs')}>
                        <SettingsIcon className="size-4" />
                      </Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="divide-y p-0">
                    {page.props.overviewCronJobs && page.props.overviewCronJobs.length > 0 ? (
                      page.props.overviewCronJobs?.map((cronJob) => (
                        <div key={cronJob.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{cronJob.name || cronJob.command}</p>
                            <p className="text-muted-foreground truncate">{cronJob.frequency}</p>
                          </div>
                          <Badge variant={cronJob.status_color}>{cronJob.status}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground px-4 py-6 text-center text-sm">{(page.props.overviewCronJobsCount ?? 0) > 0 ? <Link className="underline" href={`/servers/${site.server_id}/sites/${site.id}/resources`}>{translateText('Linked scheduled jobs are listed under Resources.')}</Link> : translateText('No scheduled jobs yet.')}</p>
                    )}
                    {(page.props.overviewCronJobsCount ?? 0) > (page.props.overviewCronJobs?.length ?? 0) && (
                      <p className="text-muted-foreground px-4 py-2 text-xs">{translateText('Showing :shown of :total', { shown: page.props.overviewCronJobs?.length ?? 0, total: page.props.overviewCronJobsCount })}</p>
                    )}
                  </CardContent>
                </Card>
              </section>
            </Deferred>
          </div>

          <Card className="overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="flex-row items-center justify-between gap-3 p-4">
              <CardTitle>{translateText('Site details')}</CardTitle>
              {site.source_control_id && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{translateText('Auto deploy')}</span>
                  <Switch
                    checked={site.auto_deploy}
                    disabled={togglingAutoDeploy}
                    onCheckedChange={handleToggleAutoDeploy}
                    aria-label={translateText('Toggle auto deploy')}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 p-4">
                <Detail icon={ServerIcon}>
                  {page.props.server.name}
                </Detail>
                <Detail icon={NetworkIcon}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{page.props.server.ip}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                      onClick={() => copyIp(page.props.server.ip)}
                      aria-label={translateText('Copy IP address')}
                      title={translateText('Copy IP address')}
                    >
                      {copiedIp ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
                    </Button>
                  </div>
                </Detail>
                {site.php_version && (
                  <Detail icon={CodeXmlIcon}>
                    {site.php_version}
                  </Detail>
                )}
                <Detail icon={LockKeyholeIcon}>
                  <Link
                    href={`/servers/${site.server_id}/sites/${site.id}/domains`}
                    className="inline-flex items-center gap-2 hover:opacity-80"
                  >
                    <span>SSL</span>
                    <Badge variant={site.ssl_enabled ? 'success' : 'outline'}>
                      {translateText(site.ssl_enabled ? 'Enabled' : 'Disabled')}
                    </Badge>
                  </Link>
                </Detail>
              </div>
            </CardContent>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
