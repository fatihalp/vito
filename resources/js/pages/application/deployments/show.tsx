import DateTime from '@/components/date-time';
import Heading from '@/components/heading';
import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLogContent } from '@/hooks/use-log-content';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, usePage } from '@inertiajs/react';
import {
  CheckCircle2Icon,
  Clock3Icon,
  DownloadIcon,
  GitCommitHorizontalIcon,
  LoaderCircleIcon,
  TerminalIcon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react';
import moment from 'moment';

function StatusIcon({ status }: { status: string }) {
  if (status === 'deploying') {
    return <LoaderCircleIcon className="text-warning size-5 animate-spin" />;
  }

  if (status === 'failed') {
    return <XCircleIcon className="text-destructive size-5" />;
  }

  return <CheckCircle2Icon className="text-success size-5" />;
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

      <div className="w-full space-y-5 px-4 py-5">
        <Heading
          title={`Deployment details · ${deployment.commit_id_short || `#${deployment.id}`}`}
          description={deployment.commit_data.message || `Deployment for ${site.domain}`}
        />

        <SiteBanners site={site} />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <StatusIcon status={deployment.status} />
            <Badge variant={deployment.status_color}>{deployment.status}</Badge>
            {deployment.active && <Badge variant="outline">active</Badge>}
          </div>
          {deployment.commit_id_short && (
            <div className="text-muted-foreground flex items-center gap-2">
              <GitCommitHorizontalIcon className="size-4" />
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
            <div className="text-muted-foreground flex items-center gap-2">
              <UserIcon className="size-4" />
              <span>{deployment.commit_data.name}</span>
            </div>
          )}
          <div className="text-muted-foreground flex items-center gap-2">
            <Clock3Icon className="size-4" />
            <DateTime date={deployment.created_at} />
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 py-3">
              <StatusIcon status={deployment.status} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="font-semibold">Deployment logs</span>
                <span className="text-muted-foreground text-xs">
                  {deployment.status === 'deploying' ? 'Streaming output in real time' : `Completed in ${duration}s`}
                </span>
              </div>
            </div>
            {deployment.log && (
              <Button variant="outline" size="icon" className="size-8 shrink-0" asChild>
                <a
                  href={route('logs.download', { server: server.id, log: deployment.log.id })}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Download deployment log"
                >
                  <DownloadIcon />
                </a>
              </Button>
            )}
          </div>
          <CardContent className="border-t p-3">
            <LogOutput className="h-[32rem] rounded-md border">
              {isLoading && 'Loading deployment output...'}
              {error && <span className="text-destructive">{error}</span>}
              {!deployment.log && (
                <span className="text-muted-foreground flex items-center gap-2">
                  <TerminalIcon className="size-4" /> No deployment output was recorded.
                </span>
              )}
              {!isLoading && !error && deployment.log && (content || (deployment.status === 'deploying' ? 'Waiting for output...' : 'No output was recorded.'))}
            </LogOutput>
          </CardContent>
        </Card>
      </div>
    </ServerLayout>
  );
}
