import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
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
import { parseCommitMessage, pullRequestUrl, safeUrl } from '@/lib/commit-message';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, Link, usePage } from '@inertiajs/react';
import { ReactNode, useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  ListIcon,
  RadioIcon,
  TerminalIcon,
} from 'lucide-react';
import moment from 'moment';

const FULL_LOG = -1;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5 text-sm">{children}</div>
    </div>
  );
}

function RelativeDate({ date }: { date: string }) {
  return (
    <span className="truncate" title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
      {moment(date).format('MMM D, HH:mm')} <span className="text-muted-foreground">· {moment(date).fromNow()}</span>
    </span>
  );
}

export default function DeploymentShow() {
  const page = usePage<{ server: Server; site: Site; deployment: Deployment; repositoryUrl: string | null }>();
  const { server, site, repositoryUrl } = page.props;
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
  const parsed = commit.message ? parseCommitMessage(commit.message) : null;
  const commitUrl = safeUrl(commit.url);
  const prUrl = parsed?.pullRequest ? pullRequestUrl(commitUrl, parsed.pullRequest) : undefined;
  const branch = parsed?.branch ?? site.branch;

  return (
    <ServerLayout>
      <Head title={`Deployment #${deployment.id} - ${site.domain}`} />

      <Container className="flex min-h-[calc(100vh-80px)] flex-col gap-3 py-4">
        <SiteBanners site={site} />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" size="icon" asChild className="size-8">
              <Link href={`/servers/${server.id}/sites/${site.id}`} title="Back to site" aria-label="Back to site">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>
            <h1 className="text-base font-semibold">Deployment #{deployment.id}</h1>
            <Badge variant={deployment.status_color} className="capitalize">
              {deployment.status}
            </Badge>
            {deployment.active && (
              <Badge variant="success" className="gap-1">
                <RadioIcon className="size-3" />
                Live
              </Badge>
            )}
            {deployment.is_duplicate && (
              <Badge variant="warning" title="This commit was already deployed previously">
                Redeploy
              </Badge>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/servers/${server.id}/sites/${site.id}/deployments`}>
                <ListIcon className="size-3.5" />
                All deployments
              </Link>
            </Button>
            {!deploying && <Deploy site={site} />}
          </div>
        </div>

        <Card className="flex flex-col gap-4 p-4 shadow-none">
          <CommitSummary commit={commit} className="text-base" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            <Fact label="Commit">
              {deployment.commit_id_short ? (
                <>
                  {commitUrl ? (
                    <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono hover:underline">
                      {deployment.commit_id_short}
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : (
                    <span className="font-mono">{deployment.commit_id_short}</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => copySha(deployment.commit_id || deployment.commit_id_short)}
                    aria-label="Copy commit SHA"
                    title="Copy commit SHA"
                  >
                    {copiedSha ? <CheckIcon className="text-success size-3" /> : <CopyIcon className="size-3" />}
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Fact>

            <Fact label={parsed?.pullRequest ? 'Pull request' : 'Branch'}>
              {parsed?.pullRequest &&
                (prUrl ? (
                  <a href={prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 font-mono hover:underline">
                    <GitPullRequestIcon className="size-3.5" />#{parsed.pullRequest}
                  </a>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono">
                    <GitPullRequestIcon className="size-3.5" />#{parsed.pullRequest}
                  </span>
                ))}
              {branch && (
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1 font-mono text-xs" title={branch}>
                  <GitBranchIcon className="size-3 shrink-0" />
                  <span className="truncate">{branch}</span>
                </span>
              )}
            </Fact>

            <Fact label={parsed?.branch ? 'Merged' : 'Committed'}>
              {commit.date ? <RelativeDate date={commit.date} /> : <span className="text-muted-foreground">—</span>}
            </Fact>

            <Fact label="Author">
              <span className="truncate" title={commit.email}>
                {commit.name ?? '—'}
              </span>
            </Fact>

            <Fact label="Deployed by">
              <span className="truncate">{deployment.deployed_by ?? 'System'}</span>
              {deployment.trigger && deployment.trigger_color && (
                <Badge variant={deployment.trigger_color} className="h-4 px-1.5 py-0 text-[10px] font-normal">
                  {deployment.trigger}
                </Badge>
              )}
            </Fact>

            <Fact label="Started">
              <RelativeDate date={deployment.created_at} />
            </Fact>

            <Fact label="Duration">
              <span className="font-mono">{elapsedSeconds != null ? formatDuration(elapsedSeconds) : '—'}</span>
            </Fact>

            <Fact label="Repository">
              {repositoryUrl ? (
                <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:underline">
                  <span className="truncate">{site.repository}</span>
                  <ExternalLinkIcon className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="truncate">{site.repository ?? '—'}</span>
              )}
            </Fact>
          </div>
        </Card>

        <div className="grid min-h-0 flex-1 items-start gap-3 2xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
          <DeploymentProgress
            deployment={deployment}
            step={step}
            defaultShowSteps
            stepDurations={stepDurations}
            selectedStep={displayedIndex}
            onStepSelect={(index) => setSelectedStep(index === activeIndex ? null : index)}
          />

          <Card className="flex h-[560px] flex-col overflow-hidden border shadow-none 2xl:h-[calc(100vh-18rem)] 2xl:min-h-[560px]">
            <div className="bg-muted/20 flex items-center justify-between gap-2 border-b px-3.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <TerminalIcon className="text-muted-foreground size-3.5 shrink-0" />
                {displayedCommand ? (
                  <code className="truncate text-xs" title={displayedCommand}>
                    $ {displayedCommand}
                  </code>
                ) : (
                  <span className="text-sm font-medium">Full output</span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {steps.length > 0 && displayedIndex !== FULL_LOG && (
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedStep(FULL_LOG)}>
                    Full output
                  </Button>
                )}
                {selectedStep !== null && (
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedStep(null)}>
                    {deploying ? 'Follow current' : 'Last step'}
                  </Button>
                )}
                {content && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => copyLog(selectedOutput)}>
                    {copiedLog ? <CheckIcon className="text-success size-3.5" /> : <CopyIcon className="size-3.5" />}
                    <span>{copiedLog ? 'Copied' : 'Copy'}</span>
                  </Button>
                )}
                {deployment.log && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" asChild>
                    <a href={`/servers/${server.id}/logs/${deployment.log.id}/download`} target="_blank" rel="noopener noreferrer">
                      <DownloadIcon className="size-3.5" />
                      <span>Download</span>
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <LogOutput key={`${deployment.id}-${displayedIndex}`} className="h-full min-h-0 w-full flex-1 rounded-none border-0 p-4">
              {isLoading && 'Loading deployment output...'}
              {error && <span className="text-destructive">{error}</span>}
              {!deployment.log && (
                <span className="text-muted-foreground flex items-center gap-2">
                  <TerminalIcon className="size-4" /> No deployment output was recorded.
                </span>
              )}
              {!isLoading && !error && deployment.log && (selectedOutput || (deploying ? 'Waiting for output...' : 'No output was recorded.'))}
            </LogOutput>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
