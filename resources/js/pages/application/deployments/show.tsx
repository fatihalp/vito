import { BreadcrumbHeader } from '@/components/breadcrumb-header';
import Container from '@/components/container';
import DateTime from '@/components/date-time';
import Heading from '@/components/heading';
import LogOutput from '@/components/log-output';
import SiteBanners from '@/components/site-banners';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLogContent } from '@/hooks/use-log-content';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import { BreadcrumbItem } from '@/types';
import { Deployment } from '@/types/deployment';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, usePage } from '@inertiajs/react';
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  Clock3Icon,
  DownloadIcon,
  ExternalLinkIcon,
  GitCommitHorizontalIcon,
  LoaderCircleIcon,
  TerminalIcon,
  UserIcon,
  XCircleIcon,
} from 'lucide-react';
import moment from 'moment';
import { useState } from 'react';

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
  const [logsOpen, setLogsOpen] = useState(true);
  const { content, isLoading, error } = useLogContent({
    serverId: server.id,
    logId: deployment.log?.id ?? 0,
    enabled: logsOpen && !!deployment.log,
  });

  const duration = moment(deployment.updated_at).diff(moment(deployment.created_at), 'seconds');
  const commitUrl = deployment.commit_data.url && /^https?:\/\//.test(deployment.commit_data.url) ? deployment.commit_data.url : undefined;
  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Application', href: route('application', { server: server.id, site: site.id }) },
    {
      title: `Deployment #${deployment.id}`,
      href: route('application.deployments.show', { server: server.id, site: site.id, deployment: deployment.id }),
    },
  ];

  return (
    <ServerLayout>
      <Head title={`Deployment #${deployment.id} - ${site.domain}`} />

      <Container className="max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <BreadcrumbHeader breadcrumbs={breadcrumbs}>
            <Heading
              title={`Deployment details · ${deployment.commit_id_short || `#${deployment.id}`}`}
              description={deployment.commit_data.message || `Deployment for ${site.domain}`}
            />
          </BreadcrumbHeader>
          <Button variant="outline" size="sm" asChild>
            <a href={site.url} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon />
              Visit site
            </a>
          </Button>
        </div>

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
          <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
            <div className="flex min-h-16 items-center justify-between gap-3 px-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-3 px-0 py-3 text-left">
                  <StatusIcon status={deployment.status} />
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="font-semibold">Deployment logs</span>
                    <span className="text-muted-foreground text-xs">
                      {deployment.status === 'deploying' ? 'Streaming output in real time' : `Completed in ${duration}s`}
                    </span>
                  </div>
                  <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${logsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
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
            <CollapsibleContent className="border-t">
              <CardContent className="p-3">
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
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </Container>
    </ServerLayout>
  );
}
