import Container from '@/components/container';
import DateTime from '@/components/date-time';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardRow, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { useDialog } from '@/hooks/use-dialog';
import ServerLayout from '@/layouts/server/layout';
import { PaginatedData } from '@/types';
import { Command } from '@/types/command';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { BookOpenIcon, Clock3Icon, CornerDownLeftIcon, LoaderCircleIcon, MoreVerticalIcon, PlayIcon, PlusIcon, TerminalIcon } from 'lucide-react';
import { FormEvent } from 'react';

function CommandRow({ command }: { command: Command }) {
  const dialog = useDialog();

  return (
    <CardRow className="gap-4 border-t first:border-t-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
          <TerminalIcon className="text-muted-foreground size-4" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{command.name}</span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              <DateTime date={command.updated_at} />
            </span>
          </div>
          <code className="text-muted-foreground truncate text-sm">{command.command}</code>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
          <Link href={route('commands.show', { server: command.server_id, site: command.site_id, command: command.id })}>
            <Clock3Icon />
            Logs
          </Link>
        </Button>
        <Button size="sm" onClick={() => dialog.commandExecute.open({ command })}>
          <PlayIcon />
          <span className="hidden sm:inline">Run</span>
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Manage ${command.name}`}>
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href={route('commands.show', { server: command.server_id, site: command.site_id, command: command.id })}>View logs</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dialog.commandEdit.open({ command })}>Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                dialog.confirm.open({
                  title: 'Delete command',
                  description: `Delete ${command.name}? Its execution history will also be removed.`,
                  variant: 'destructive',
                  confirmLabel: 'Delete',
                  method: 'delete',
                  url: route('commands.destroy', { server: command.server_id, site: command.site_id, command: command.id }),
                })
              }
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardRow>
  );
}

export default function Commands() {
  const page = usePage<{
    server: Server;
    site: Site;
    commands: PaginatedData<Command>;
  }>();
  const dialog = useDialog();
  const { commands, server, site } = page.props;
  const form = useForm({ command: '' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(route('commands.quick-run', { server: server.id, site: site.id }));
  };

  const visitPage = (url: string | null) => {
    if (url) {
      router.get(url, {}, { preserveScroll: true });
    }
  };

  return (
    <ServerLayout>
      <Head title={`Commands - ${site.domain} - ${server.name}`} />

      <Container className="max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <Heading title="Commands" description={`Run a command in ${site.domain}'s working directory and follow its output live.`} />
          <Button variant="outline" size="sm" asChild>
            <a href="https://vitodeploy.com/docs/sites/commands" target="_blank" rel="noopener noreferrer">
              <BookOpenIcon />
              <span className="hidden sm:inline">Docs</span>
            </a>
          </Button>
        </div>

        <SiteBanners site={site} />

        <Card>
          <CardHeader>
            <CardTitle>Run new command</CardTitle>
            <CardDescription>
              Commands run from the site's root directory as <code className="text-foreground">{site.user}</code>. The output opens automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <form onSubmit={submit} className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <TerminalIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={form.data.command}
                  onChange={(event) => form.setData('command', event.target.value)}
                  placeholder="php artisan about"
                  className="h-11 pl-10 font-mono"
                  autoComplete="off"
                  autoFocus
                  aria-label="Command to run"
                />
              </div>
              <Button type="submit" className="h-11 shrink-0" disabled={form.processing || !form.data.command.trim()}>
                {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <CornerDownLeftIcon />}
                <span className="hidden sm:inline">Run</span>
              </Button>
            </form>
            <InputError message={form.errors.command} className="px-2 pt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Recent commands</CardTitle>
              <CardDescription>Run a saved command again or open its execution history.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => dialog.commandCreate.open({ serverId: server.id, siteId: site.id })}>
              <PlusIcon />
              <span className="hidden sm:inline">Save command</span>
            </Button>
          </CardHeader>
          <CardContent>
            {commands.data.length > 0 ? (
              commands.data.map((command) => <CommandRow key={command.id} command={command} />)
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <TerminalIcon className="text-muted-foreground size-6" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">No recent commands</h3>
                  <p className="text-muted-foreground text-sm">Run a command above and it will appear here for next time.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(commands.links.prev || commands.links.next) && (
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={!commands.links.prev} onClick={() => visitPage(commands.links.prev)}>
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">Page {commands.meta.current_page}</span>
            <Button variant="outline" disabled={!commands.links.next} onClick={() => visitPage(commands.links.next)}>
              Next
            </Button>
          </div>
        )}
      </Container>
    </ServerLayout>
  );
}
