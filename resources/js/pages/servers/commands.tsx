import { useCallback, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import {
  CheckIcon,
  CopyIcon,
  FolderIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  TerminalIcon,
  UserIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRealtimeRecord } from '@/hooks/use-socket-events';

type CommandItem = {
  timestamp: string;
  user: string;
  pwd: string | null;
  target_user: string | null;
  command: string;
};

type PageProps = {
  server: Server;
  initialData: {
    source: 'sudo' | 'bash';
    items: CommandItem[];
  };
};

function CommandRow({ item }: { item: CommandItem }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-1.5 p-3 hover:bg-muted/40 transition-colors sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:pr-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="font-mono text-[11px] gap-1 px-1.5 py-0">
            <UserIcon className="size-3 text-muted-foreground" />
            <span>{item.user}</span>
            {item.target_user && item.target_user !== item.user && (
              <span className="text-muted-foreground">&rarr; {item.target_user}</span>
            )}
          </Badge>

          {item.pwd && (
            <span className="text-muted-foreground text-[11px] font-mono flex items-center gap-1 truncate max-w-xs">
              <FolderIcon className="size-3 shrink-0" />
              <span className="truncate">{item.pwd}</span>
            </span>
          )}

          <span className="text-muted-foreground/80 text-[11px] sm:ml-auto">
            {item.timestamp}
          </span>
        </div>

        <div className="font-mono text-xs text-foreground bg-muted/30 dark:bg-muted/20 border border-border/50 rounded px-2.5 py-1.5 break-all whitespace-pre-wrap select-text">
          {item.command}
        </div>
      </div>

      <div className="flex shrink-0 items-center self-end sm:self-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={handleCopy}
          aria-label="Copy command"
        >
          {copied ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function ServerCommands() {
  const { server: initialServer, initialData } = usePage<PageProps>().props;
  const server = useRealtimeRecord<Server>(initialServer, 'server') ?? initialServer;

  const [source, setSource] = useState<'sudo' | 'bash'>(initialData?.source ?? 'sudo');
  const [lines, setLines] = useState<string>('100');
  const [search, setSearch] = useState<string>('');
  const [items, setItems] = useState<CommandItem[]>(initialData?.items ?? []);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchCommands = useCallback(
    async (newSource = source, newLines = lines, newSearch = search) => {
      setLoading(true);
      try {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const response = await fetch(route('servers.commands.query', { server: server.id }), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': token,
            'X-Requested-With': 'XMLHttpRequest',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            source: newSource,
            lines: parseInt(newLines, 10),
            search: newSearch,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setItems(data.items ?? []);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    },
    [lines, search, server.id, source]
  );

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.command.toLowerCase().includes(q) ||
      item.user.toLowerCase().includes(q) ||
      (item.pwd && item.pwd.toLowerCase().includes(q))
    );
  });

  return (
    <ServerLayout>
      <Head title={`Commands - ${server.name}`} />

      <Container className="max-w-5xl space-y-5">
        <HeaderContainer>
          <Heading
            title="Commands"
            description="Audit log and command execution history on this server."
          />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 cursor-pointer"
            onClick={() => fetchCommands()}
            disabled={loading || !server.is_ready}
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </HeaderContainer>

        <Card className="border-border/60 shadow-2xs">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Command History</CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono">
                {filteredItems.length}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-48 sm:w-60">
                <SearchIcon className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter commands..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Select
                value={source}
                onValueChange={(val: 'sudo' | 'bash') => {
                  setSource(val);
                  fetchCommands(val, lines, search);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sudo">Privileged (Sudo)</SelectItem>
                  <SelectItem value="bash">Shell (.bash_history)</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={lines}
                onValueChange={(val) => {
                  setLines(val);
                  fetchCommands(source, val, search);
                }}
              >
                <SelectTrigger className="h-8 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 lines</SelectItem>
                  <SelectItem value="100">100 lines</SelectItem>
                  <SelectItem value="200">200 lines</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground text-xs">
                <LoaderCircleIcon className="size-5 animate-spin text-primary" />
                <span>Fetching command history from server...</span>
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="divide-y divide-border/60">
                {filteredItems.map((item, idx) => (
                  <CommandRow key={`${item.timestamp}-${idx}`} item={item} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center">
                <TerminalIcon className="size-5 text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No commands found</p>
                <p className="text-xs text-muted-foreground">
                  {search
                    ? 'No commands match your filter criteria.'
                    : 'No command execution records were returned for this source.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </Container>
    </ServerLayout>
  );
}
