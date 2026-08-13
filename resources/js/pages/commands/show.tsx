import { BreadcrumbHeader } from '@/components/breadcrumb-header';
import Container from '@/components/container';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDialog } from '@/hooks/use-dialog';
import { useRealtime } from '@/hooks/use-socket-events';
import ServerLayout from '@/layouts/server/layout';
import ExecutionLog from '@/pages/commands/components/execution-log';
import { BreadcrumbItem, PaginatedData } from '@/types';
import { CommandExecution } from '@/types/command-execution';
import { Command } from '@/types/command';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, router, usePage } from '@inertiajs/react';
import { PlayIcon, TerminalIcon } from 'lucide-react';

type Page = {
  server: Server;
  site: Site;
  command: Command;
  executions: PaginatedData<CommandExecution>;
};

export default function Show() {
  const page = usePage<Page>();
  const dialog = useDialog();
  const { command, server, site } = page.props;
  const [executions] = useRealtime<CommandExecution>(page.props.executions, 'command-execution', { command_id: command.id });

  const visitPage = (url: string | null) => {
    if (url) {
      router.get(url, {}, { preserveScroll: true });
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: 'Commands',
      href: route('commands', { server: server.id, site: site.id }),
    },
    {
      title: command.name,
      href: route('commands.show', { server: server.id, site: site.id, command: command.id }),
    },
  ];

  return (
    <ServerLayout>
      <Head title={`${command.name} - ${site.domain} - ${server.name}`} />

      <Container className="max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <BreadcrumbHeader breadcrumbs={breadcrumbs}>
            <Heading title={command.name} description="Run the command and follow its output here in real time." />
          </BreadcrumbHeader>
          <Button onClick={() => dialog.commandExecute.open({ command })}>
            <PlayIcon />
            Run again
          </Button>
        </div>

        <SiteBanners site={site} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="size-4" />
              Command
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <pre className="bg-muted/70 overflow-auto rounded-md border p-4 font-mono text-sm break-all whitespace-pre-wrap">{command.command}</pre>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Execution logs</h2>
            <p className="text-muted-foreground text-sm">The newest execution opens automatically and streams output as it arrives.</p>
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
                  <p className="text-muted-foreground text-sm">Run the command to see its live output here.</p>
                </div>
                <Button onClick={() => dialog.commandExecute.open({ command })}>
                  <PlayIcon />
                  Run command
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </Container>
    </ServerLayout>
  );
}
