import { useTranslate } from '@/hooks/use-translate';
import Container from '@/components/container';
import DateTime from '@/components/date-time';
import Heading from '@/components/heading';
import SiteBanners from '@/components/site-banners';
import { Button } from '@/components/ui/button';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { Card, CardContent, CardHeader, CardRow, CardTitle } from '@/components/ui/card';
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
import { Clock3Icon, CornerDownLeftIcon, LoaderCircleIcon, PlayIcon, PlusIcon, TerminalIcon } from 'lucide-react';
import { FormEvent } from 'react';

function CommandRow({ command }: { command: Command }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <CardRow className="gap-4 border-t first:border-t-0">
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
          <Link href={`/servers/${command.server_id}/sites/${command.site_id}/commands/${command.id}`}>
            <Clock3Icon />
            {translateText('Logs')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => dialog.commandExecute.open({ command })}>
          <PlayIcon />
          <span className="hidden sm:inline">{translateText('Run')}</span>
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <TableActionTrigger iconOnly aria-label={translateText("Manage :value", { value: command.name })} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="sm:hidden">
              <Link href={`/servers/${command.server_id}/sites/${command.site_id}/commands/${command.id}`}>{translateText('View logs')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dialog.commandEdit.open({ command })}>{translateText('Edit')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                dialog.confirm.open({
                  title: 'Delete command',
                  description: translateText("Delete :value? Its execution history will also be removed.", { value: command.name }),
                  variant: 'destructive',
                  confirmLabel: 'Delete',
                  method: 'delete',
                  url: `/servers/${command.server_id}/sites/${command.site_id}/commands/${command.id}`,
                })
              }
            >
              {translateText('Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </CardRow>
  );
}

export default function Commands() {
  const translateText = useTranslate();
  const page = usePage<{
    server: Server;
    site: Site;
    commands: PaginatedData<Command>;
    suggestedCommands: string[];
  }>();
  const dialog = useDialog();
  const { commands, suggestedCommands, server, site } = page.props;
  const form = useForm({ command: '' });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    form.post(`/servers/${server.id}/sites/${site.id}/commands/quick-run`);
  };

  const visitPage = (url: string | null) => {
    if (url) {
      router.get(url, {}, { preserveScroll: true });
    }
  };

  return (
    <ServerLayout>
      <Head title={translateText("Commands - :value - :value2", { value: site.domain, value2: server.name })} />

      <Container>
        <Heading title={translateText('Commands')} />

        <SiteBanners site={site} />

        <Card>
          <CardContent className="p-2">
            <form onSubmit={submit} className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <TerminalIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  value={form.data.command}
                  onChange={(event) => form.setData('command', event.target.value)}
                  placeholder="php artisan about"
                  className="h-9 pl-10 font-mono"
                  autoComplete="off"
                  autoFocus
                  aria-label={translateText("Command to run")}
                />
              </div>
              <Button type="submit" className="h-9 shrink-0" disabled={form.processing || !form.data.command.trim()}>
                {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <CornerDownLeftIcon />}
                <span className="hidden sm:inline">{translateText('Run')}</span>
              </Button>
            </form>
            <InputError message={form.errors.command} className="px-2 pt-2" />
            {suggestedCommands.length > 0 && (
              <details className="px-2 pt-2 text-xs">
                <summary className="text-muted-foreground cursor-pointer">{translateText("Recent inputs")}</summary>
                <div className="flex flex-col gap-1 pt-2">
                {suggestedCommands.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="max-w-full justify-start font-mono text-xs"
                    title={suggestion}
                    onClick={() => form.setData('command', suggestion)}
                  >
                    <span className="truncate">{suggestion}</span>
                  </Button>
                ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <CardTitle>{translateText("Saved commands")}</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => dialog.commandCreate.open({ serverId: server.id, siteId: site.id })}>
              <PlusIcon />
              <span className="hidden sm:inline">{translateText("Save command")}</span>
            </Button>
          </CardHeader>
          <CardContent>
            {commands.data.length > 0 ? (
              commands.data.map((command) => <CommandRow key={command.id} command={command} />)
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <TerminalIcon className="text-muted-foreground size-6" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{translateText("No recent commands")}</h3>
                  <p className="text-muted-foreground text-sm">{translateText("Run a command above and it will appear here for next time.")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(commands.links.prev || commands.links.next) && (
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={!commands.links.prev} onClick={() => visitPage(commands.links.prev)}>
              {translateText('Previous')}
            </Button>
            <span className="text-muted-foreground text-sm">{translateText('Page')} {commands.meta.current_page}</span>
            <Button variant="outline" disabled={!commands.links.next} onClick={() => visitPage(commands.links.next)}>
              {translateText('Next')}
            </Button>
          </div>
        )}
      </Container>
    </ServerLayout>
  );
}
