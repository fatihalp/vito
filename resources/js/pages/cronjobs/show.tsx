import { BreadcrumbHeader } from '@/components/breadcrumb-header';
import Container from '@/components/container';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import ExecutionLog from '@/pages/commands/components/execution-log';
import { BreadcrumbItem, PaginatedData } from '@/types';
import { CommandExecution } from '@/types/command-execution';
import { CronJob } from '@/types/cronjob';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AlertCircleIcon, ClockIcon, LoaderCircleIcon, PlayIcon, TerminalIcon, UserIcon } from 'lucide-react';

type Page = {
  server: Server;
  site?: Site;
  cronjob: CronJob;
  executions: PaginatedData<CommandExecution>;
};

export default function Show() {
  const page = usePage<Page>();
  const { cronjob, server, site } = page.props;
  const [executions] = useRealtime<CommandExecution>(page.props.executions, 'command-execution', { cron_job_id: cronjob.id });
  const runForm = useForm();

  const indexUrl = site
    ? `/servers/${server.id}/sites/${site.id}/cronjobs`
    : `/servers/${server.id}/cronjobs`;

  const showUrl = `${indexUrl}/${cronjob.id}`;
  const executeUrl = `${showUrl}/execute`;
  const title = cronjob.name || `Cron job #${cronjob.id}`;

  const runCronJob = () => {
    runForm.post(executeUrl, { preserveScroll: true });
  };

  const visitPage = (url: string | null) => {
    if (url) {
      router.get(url, {}, { preserveScroll: true });
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: 'Cron jobs',
      href: indexUrl,
    },
    {
      title,
      href: showUrl,
    },
  ];

  const isArtisanMissingCd = cronjob.command.includes('artisan') && !cronjob.command.includes('cd ');
  const isSchedulerWrongFrequency = cronjob.command.includes('schedule:run') && cronjob.frequency !== '* * * * *';

  return (
    <ServerLayout>
      <Head title={`${title} - ${site ? `${site.domain} - ` : ''}${server.name}`} />

      <Container>
        <div className="flex items-start justify-between gap-4">
          <BreadcrumbHeader breadcrumbs={breadcrumbs}>
            <Heading title={title} description="Run the cron job manually and follow its execution history and output logs." />
          </BreadcrumbHeader>
          <Button onClick={runCronJob} disabled={runForm.processing}>
            {runForm.processing ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
            Run now
          </Button>
        </div>

        {site && <SiteBanners site={site} />}

        {(isArtisanMissingCd || isSchedulerWrongFrequency) && (
          <div className="space-y-3">
            {isArtisanMissingCd && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>Missing site directory in command</AlertTitle>
                <AlertDescription>
                  This command runs <code className="font-mono font-semibold">artisan</code> without first changing directory. In background execution via the server's cron daemon, the shell starts in the user's home folder (<code className="font-mono font-semibold">/home/{cronjob.user}</code>), where <code className="font-mono font-semibold">artisan</code> cannot be found. Consider updating the command to:
                  <code className="mt-1.5 block overflow-x-auto rounded bg-muted/60 p-2 font-mono text-xs">
                    cd {site?.path || `/home/${cronjob.user}/${site?.domain || 'site-path'}`} &amp;&amp; {cronjob.command}
                  </code>
                </AlertDescription>
              </Alert>
            )}
            {isSchedulerWrongFrequency && (
              <Alert>
                <AlertCircleIcon className="size-4 text-amber-500" />
                <AlertTitle>Non-standard Laravel scheduler frequency</AlertTitle>
                <AlertDescription>
                  Laravel Task Scheduler (<code className="font-mono">schedule:run</code>) is set to <code className="font-mono font-semibold">{cronjob.frequency}</code>. It should run <strong>every minute</strong> (<code className="font-mono font-semibold">* * * * *</code>) so that tasks scheduled inside your Laravel application run at their intended time.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="size-4" />
              Command
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1 font-mono text-xs">
                <ClockIcon className="size-3" />
                {cronjob.frequency}
              </Badge>
              <Badge variant="outline" className="gap-1 font-mono text-xs">
                <UserIcon className="size-3" />
                {cronjob.user}
              </Badge>
              <Badge variant={cronjob.status_color}>{cronjob.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <pre className="bg-muted/70 overflow-auto rounded-md border p-4 font-mono text-sm break-all whitespace-pre-wrap">{cronjob.command}</pre>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Execution logs</h2>
            <p className="text-muted-foreground text-sm">
              Live stream from manual runs. Scheduled background executions run directly via the server's cron daemon and do not stream here.
            </p>
          </div>
          {executions.data.length > 0 ? (
            <>
              {executions.data.map((execution, index) => (
                <ExecutionLog key={execution.id} execution={execution} initiallyOpen={index === 0} />
              ))}
              {(executions.links.prev || executions.links.next) && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <Button variant="outline" disabled={!executions.links.prev} onClick={() => visitPage(executions.links.prev)}>
                    Previous
                  </Button>
                  <span className="text-muted-foreground text-sm">Page {executions.meta.current_page}</span>
                  <Button variant="outline" disabled={!executions.links.next} onClick={() => visitPage(executions.links.next)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <TerminalIcon className="text-muted-foreground size-6" />
                <div>
                  <h3 className="font-medium">No executions yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Run the cron job manually to see its live output and execution history here. (Background runs handled by the OS cron daemon are not tracked in this log.)
                  </p>
                </div>
                <Button onClick={runCronJob} disabled={runForm.processing}>
                  {runForm.processing ? <LoaderCircleIcon className="animate-spin" /> : <PlayIcon />}
                  Run cron job
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </Container>
    </ServerLayout>
  );
}
