import DateTime from '@/components/date-time';
import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLogContent } from '@/hooks/use-log-content';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, Link, usePage } from '@inertiajs/react';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  GitCommitHorizontalIcon,
  LoaderCircleIcon,
  TerminalIcon,
  TimerIcon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react';
import moment from 'moment';

function StatusIcon({ status }: { status: string }) {
  if (status === 'deploying') {
    return <LoaderCircleIcon className="text-warning size-5 animate-spin shrink-0" />;
  }

  if (status === 'failed') {
    return <XCircleIcon className="text-destructive size-5 shrink-0" />;
  }

  return <CheckCircle2Icon className="text-success size-5 shrink-0" />;
}

export default function DeploymentShow() {
  const page = usePage<{ server: Server; site: Site; deployment: Deployment }>();
  const { server, site } = page.props;
  const deployment = useRealtimeRecord<Deployment>(page.props.deployment, 'deployment')!;
  const { content, isLoading, error } = useLogContent({
    serverId: server.id,
    logId: deployment.log?.id ?? 0,
    enabled: !!deployment.log,
  });

  const duration = moment(deployment.updated_at).diff(moment(deployment.created_at), 'seconds');
  const commitUrl = deployment.commit_data.url && /^https?:\/\//.test(deployment.commit_data.url) ? deployment.commit_data.url : undefined;

  return (
    <ServerLayout>
      <Head title={`Deployment #${deployment.id} - ${site.domain}`} />

      <Container className="max-w-7xl gap-4 py-5 flex flex-col min-h-[calc(100vh-80px)]">
        <SiteBanners site={site} />

        {/* Unified Top Header Bar */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild className="h-9 gap-1.5 cursor-pointer">
                <Link href={route('application.deployments.index', { server: server.id, site: site.id })}>
                  <ArrowLeftIcon className="size-4" />
                  <span>Deployments</span>
                </Link>
              </Button>

              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusIcon status={deployment.status} />
                <h1 className="text-xl font-bold tracking-tight">
                  Deployment {deployment.commit_id_short ? `· ${deployment.commit_id_short}` : `#${deployment.id}`}
                </h1>
                <Badge variant={deployment.status_color}>{deployment.status}</Badge>
                {deployment.active && <Badge variant="outline">active</Badge>}
              </div>
            </div>

            {deployment.log && (
              <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer" asChild>
                <a
                  href={route('logs.download', { server: server.id, log: deployment.log.id })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DownloadIcon className="size-4" />
                  <span>Download log</span>
                </a>
              </Button>
            )}
          </div>

          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground px-1">
            {deployment.commit_data.message && (
              <span className="font-medium text-foreground max-w-lg truncate" title={deployment.commit_data.message}>
                {deployment.commit_data.message}
              </span>
            )}

            {deployment.commit_id_short && (
              <div className="flex items-center gap-1.5">
                <GitCommitHorizontalIcon className="size-3.5" />
                {commitUrl ? (
                  <a href={commitUrl} target="_blank" rel="noopener noreferrer" className="text-foreground font-mono hover:underline">
                    {deployment.commit_id_short}
                  </a>
                ) : (
                  <span className="text-foreground font-mono">{deployment.commit_id_short}</span>
                )}
              </div>
            )}

            {deployment.commit_data.name && (
              <div className="flex items-center gap-1.5">
                <UserIcon className="size-3.5" />
                <span>{deployment.commit_data.name}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5" title={moment(deployment.created_at).format('YYYY-MM-DD HH:mm:ss')}>
              <Clock3Icon className="size-3.5" />
              <span>
                <DateTime date={deployment.created_at} relative /> (<DateTime date={deployment.created_at} />)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <TimerIcon className="size-3.5" />
              <span>
                {deployment.status === 'deploying' ? 'Streaming in real time' : `Completed in ${duration}s`}
              </span>
            </div>
          </div>
        </div>

        {/* Full Height Log Viewer */}
        <Card className="flex-1 overflow-hidden border flex flex-col min-h-[550px]">
          <LogOutput className="h-[calc(100vh-250px)] min-h-[550px] w-full flex-1 rounded-none border-0 p-4">
            {isLoading && 'Loading deployment output...'}
            {error && <span className="text-destructive">{error}</span>}
            {!deployment.log && (
              <span className="text-muted-foreground flex items-center gap-2">
                <TerminalIcon className="size-4" /> No deployment output was recorded.
              </span>
            )}
            {!isLoading && !error && deployment.log && (content || (deployment.status === 'deploying' ? 'Waiting for output...' : 'No output was recorded.'))}
          </LogOutput>
        </Card>
      </Container>
    </ServerLayout>
  );
}
