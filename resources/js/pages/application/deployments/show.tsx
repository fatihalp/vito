import { useTranslate } from '@/hooks/use-translate';
import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useClipboard } from '@/hooks/use-clipboard';
import { useLogContent } from '@/hooks/use-log-content';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import Deploy from '@/pages/application/components/deploy';
import CommitSummary from '@/pages/application/components/commit-summary';
import DeploymentProgress, { formatDuration } from '@/pages/application/deployments/progress';
import { safeUrl } from '@/lib/commit-message';
import { cn } from '@/lib/utils';
import { DEPLOYMENT_STATES, DeploymentStateGlyph, deploymentActor, deploymentState } from '@/pages/application/components/deployment-state';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, CheckIcon, CopyIcon, DownloadIcon, RotateCcwIcon, TerminalIcon } from 'lucide-react';
import moment from 'moment';
import DateTime from '@/components/date-time';

const FULL_LOG = -1;

export default function DeploymentShow() {
  const translateText = useTranslate();
  const page = usePage<{ server: Server; site: Site; deployment: Deployment }>();
  const { server, site } = page.props;
  const deployment = useRealtimeRecord<Deployment>(page.props.deployment, 'deployment')!;
  const { copied: copiedSha, copy: copySha } = useClipboard();
  const { copied: copiedLog, copy: copyLog } = useClipboard();

  const { content, segments, step, isLoading, error } = useLogContent({
    serverId: server.id,
    logId: deployment.log?.id ?? 0,
    enabled: !!deployment.log,
  });

  const deploying = deployment.status === 'deploying';
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deploying) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deploying]);

  const steps = deployment.progress?.steps ?? [];
  const current = step ? steps.findLastIndex((item) => item.group === step.group && item.line <= step.line) : -1;
  const activeIndex = deployment.status === 'finished' ? steps.length - 1 : current;
  const displayedIndex = selectedStep ?? activeIndex;
  const stepLogs = steps.map((_, index) =>
    segments.filter((segment) => steps.findLastIndex((item) => item.group === segment.group && item.line <= segment.line) === index),
  );
  const end = deploying ? now : moment(deployment.finished_at ?? deployment.updated_at).valueOf();
  const stepDurations = stepLogs.map((logs) => {
    if (!logs.length || logs.some((log) => log.startedAt === null)) return null;
    return logs.reduce((total, log) => total + Math.max(0, ((log.endedAt ?? end) - log.startedAt!) / 1000), 0);
  });
  const selectedOutput = displayedIndex >= 0 ? (stepLogs[displayedIndex]?.map((log) => log.output).join('') ?? '') : content;
  const displayedCommand = displayedIndex >= 0 ? steps[displayedIndex]?.command : null;

  const elapsedSeconds = deployment.duration ?? (deploying ? (now - moment(deployment.created_at).valueOf()) / 1000 : null);

  const commit = deployment.commit_data ?? {};
  const commitUrl = safeUrl(commit.url);
  const state = deploymentState(deployment);
  const actor = deploymentActor(deployment);

  return (
    <ServerLayout>
      <Head title={`${translateText("Deployment")} #${deployment.id} - ${site.domain}`} />

      <Container className="flex flex-col gap-3 py-4 lg:h-[calc(100vh-80px)] lg:min-h-[36rem]">
        <SiteBanners site={site} />

        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="size-8 shrink-0">
            <Link href={`/servers/${server.id}/sites/${site.id}`} title={translateText("Back to site")} aria-label={translateText("Back to site")}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1 className="min-w-0">
              {commit.message ? (
                <CommitSummary commit={commit} className="text-lg font-semibold" />
              ) : (
                <span className="flex min-w-0 items-center gap-2 text-lg font-semibold">
                  Deployment #{deployment.id}
                  {site.branch && <span className="text-muted-foreground truncate font-mono text-sm font-normal">{site.branch}</span>}
                </span>
              )}
            </h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
              <span className={cn('inline-flex items-center gap-1.5 font-medium', DEPLOYMENT_STATES[state].className)}>
                <DeploymentStateGlyph state={state} />
                {translateText(DEPLOYMENT_STATES[state].label)}
              </span>
              {elapsedSeconds != null && <span className="tabular-nums">· {formatDuration(elapsedSeconds)}</span>}
              {actor && <span>· {actor}</span>}
              <span title={moment(deployment.created_at).format('YYYY-MM-DD HH:mm:ss')}>· <DateTime date={deployment.created_at} relative /></span>
              {deployment.commit_id && (
                <span className="inline-flex items-center gap-0.5">
                  ·
                  {commitUrl ? (
                    <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground ml-1 font-mono hover:underline">
                      {deployment.commit_id_short}
                    </a>
                  ) : (
                    <span className="ml-1 font-mono">{deployment.commit_id_short}</span>
                  )}
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => copySha(deployment.commit_id)} aria-label={translateText("Copy commit SHA")} title={translateText("Copy commit SHA")}>
                    {copiedSha ? <CheckIcon className="text-success size-3" /> : <CopyIcon className="size-3" />}
                  </Button>
                </span>
              )}
              {deployment.is_duplicate && (
                <span className="text-warning inline-flex items-center gap-1" title={translateText("This commit was already deployed previously")}>
                  · <RotateCcwIcon className="size-3.5" />
                  {translateText('Redeploy')}
                </span>
              )}
            </div>
          </div>

          {!deploying && <Deploy site={site} variant="outline" />}
        </div>

        <div className="grid min-h-0 flex-1 content-start gap-3 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
          <DeploymentProgress
            deployment={deployment}
            step={step}
            defaultShowSteps
            className="lg:max-h-full lg:self-start lg:overflow-y-auto"
            stepDurations={stepDurations}
            selectedStep={displayedIndex}
            onStepSelect={(index) => setSelectedStep(index === activeIndex ? null : index)}
          />

          <Card className="flex h-[70vh] min-h-80 flex-col overflow-hidden border shadow-none lg:h-auto lg:min-h-0">
            <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <TerminalIcon className="text-muted-foreground size-3.5 shrink-0" />
                {displayedCommand ? (
                  <code className="truncate text-xs" title={displayedCommand}>
                    $ {displayedCommand}
                  </code>
                ) : (
                  <span className="text-sm font-medium">{translateText('Full output')}</span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {steps.length > 0 && displayedIndex !== FULL_LOG && (
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedStep(FULL_LOG)}>
                    {translateText('Full output')}
                  </Button>
                )}
                {selectedStep !== null && (
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedStep(null)}>
                    {translateText(deploying ? 'Follow current' : 'Last step')}
                  </Button>
                )}
                {content && (
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => copyLog(selectedOutput)} aria-label={translateText("Copy output")} title={translateText("Copy output")}>
                    {copiedLog ? <CheckIcon className="text-success size-3.5" /> : <CopyIcon className="size-3.5" />}
                  </Button>
                )}
                {deployment.log && (
                  <Button variant="ghost" size="icon" className="size-8" asChild>
                    <a href={`/servers/${server.id}/logs/${deployment.log.id}/download`} target="_blank" rel="noopener noreferrer" aria-label={translateText("Download output")} title={translateText("Download output")}>
                      <DownloadIcon className="size-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <LogOutput key={`${deployment.id}-${displayedIndex}`} className="h-full min-h-0 w-full flex-1 rounded-none border-0 p-4">
              {isLoading && translateText('Loading deployment output...')}
              {error && <span className="text-destructive">{error}</span>}
              {!deployment.log && (
                <span className="text-muted-foreground flex items-center gap-2">
                  <TerminalIcon className="size-4" /> {translateText("No deployment output was recorded.")}
                </span>
              )}
              {!isLoading && !error && deployment.log && (selectedOutput || translateText(deploying ? 'Waiting for output...' : 'No output was recorded.'))}
            </LogOutput>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
