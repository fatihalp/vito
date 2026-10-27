import DateTime from '@/components/date-time';
import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useClipboard } from '@/hooks/use-clipboard';
import { useDialog } from '@/hooks/use-dialog';
import { useLogContent } from '@/hooks/use-log-content';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import Deploy from '@/pages/application/components/deploy';
import DeploymentProgress, { formatDuration } from '@/pages/application/deployments/progress';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, Link, usePage } from '@inertiajs/react';
import { useMemo } from 'react';
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  TerminalIcon,
} from 'lucide-react';
import moment from 'moment';

export default function DeploymentShow() {
  const page = usePage<{ server: Server; site: Site; deployment: Deployment }>();
  const { server, site } = page.props;
  const deployment = useRealtimeRecord<Deployment>(page.props.deployment, 'deployment')!;
  const dialog = useDialog();
  const { copied: copiedSha, copy: copySha } = useClipboard();
  const { copied: copiedLog, copy: copyLog } = useClipboard();

  const { content, step, isLoading, error } = useLogContent({
    serverId: server.id,
    logId: deployment.log?.id ?? 0,
    enabled: !!deployment.log,
  });

  const durationText = useMemo(() => {
    if (deployment.formatted_duration) {
      return deployment.formatted_duration;
    }
    const end = deployment.finished_at ?? (deployment.status !== 'deploying' ? deployment.updated_at : null);
    if (!end) return null;

    return formatDuration(moment(end).diff(moment(deployment.created_at), 'seconds'));
  }, [deployment.formatted_duration, deployment.finished_at, deployment.updated_at, deployment.created_at, deployment.status]);

  const commitUrl =
    deployment.commit_data.url && /^https?:\/\//.test(deployment.commit_data.url)
      ? deployment.commit_data.url
      : undefined;

  return (
    <ServerLayout>
      <Head title={`Deployment #${deployment.id} - ${site.domain}`} />

      <Container className="max-w-7xl gap-3 py-4 flex flex-col min-h-[calc(100vh-80px)]">
        <SiteBanners site={site} />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-wrap text-sm text-muted-foreground">
            <Button variant="outline" size="icon" asChild className="size-8 cursor-pointer">
              <Link href={`/servers/${server.id}/sites/${site.id}/deployments`} title="Back to deployments">
                <ArrowLeftIcon className="size-4" />
              </Link>
            </Button>

            <h1 className="text-base font-semibold text-foreground">
              Deployment #{deployment.id}
            </h1>

            <Badge variant={deployment.status_color}>{deployment.status}</Badge>
            {deployment.active && <Badge variant="outline">active</Badge>}

            {deployment.commit_id_short && (
              <div className="flex items-center gap-1">
                <span>·</span>
                {commitUrl ? (
                  <a
                    href={commitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground font-mono hover:underline inline-flex items-center gap-1"
                  >
                    <span>{deployment.commit_id_short}</span>
                    <ExternalLinkIcon className="size-3" />
                  </a>
                ) : (
                  <span className="text-foreground font-mono">{deployment.commit_id_short}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 cursor-pointer"
                  onClick={() => copySha(deployment.commit_id || deployment.commit_id_short)}
                  title="Copy commit SHA"
                >
                  {copiedSha ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                </Button>
              </div>
            )}

            {deployment.commit_data.message && (
              <span className="text-foreground max-w-md truncate" title={deployment.commit_data.message}>
                · {deployment.commit_data.message}
              </span>
            )}

            <span>
              · by {deployment.deployed_by ?? 'System'}
            </span>

            <span title={moment(deployment.created_at).format('YYYY-MM-DD HH:mm:ss')}>
              · <DateTime date={deployment.created_at} relative />
            </span>

            {durationText && <span>· {durationText}</span>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!deployment.active && deployment.release && deployment.status === 'finished' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-destructive hover:text-destructive cursor-pointer"
                onClick={() =>
                  dialog.confirm.open({
                    title: 'Rollback',
                    description: `Are you sure you want to rollback your site to version [${deployment.release}]?`,
                    confirmLabel: 'Rollback',
                    method: 'post',
                    url: `/servers/${encodeURIComponent(String(server.id))}/sites/${site.id}/rollback/${deployment.id}`,
                  })
                }
              >
                <RotateCcwIcon className="size-3.5" />
                <span>Rollback</span>
              </Button>
            )}

            {deployment.status !== 'deploying' && <Deploy site={site} />}
          </div>
        </div>

        <DeploymentProgress deployment={deployment} step={step} defaultShowSteps={true} />

        <Card className="flex-1 overflow-hidden border shadow-none flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between border-b px-3.5 py-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Output</span>
            </div>

            <div className="flex items-center gap-1">
              {content && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-sm gap-1.5 cursor-pointer"
                  onClick={() => copyLog(content)}
                >
                  {copiedLog ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                  <span>{copiedLog ? 'Copied' : 'Copy'}</span>
                </Button>
              )}

              {deployment.log && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-sm gap-1.5 cursor-pointer" asChild>
                  <a
                    href={`/servers/${server.id}/logs/${deployment.log.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <DownloadIcon className="size-3.5" />
                    <span>Download</span>
                  </a>
                </Button>
              )}
            </div>
          </div>

          <LogOutput className="h-[calc(100vh-260px)] min-h-[500px] w-full flex-1 rounded-none border-0 p-4">
            {isLoading && 'Loading deployment output...'}
            {error && <span className="text-destructive">{error}</span>}
            {!deployment.log && (
              <span className="text-muted-foreground flex items-center gap-2">
                <TerminalIcon className="size-4" /> No deployment output was recorded.
              </span>
            )}
            {!isLoading &&
              !error &&
              deployment.log &&
              (content ||
                (deployment.status === 'deploying' ? 'Waiting for output...' : 'No output was recorded.'))}
          </LogOutput>
        </Card>
      </Container>
    </ServerLayout>
  );
}
