import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BrushCleaningIcon, FileTextIcon, LoaderCircleIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDialog } from '@/hooks/use-dialog';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/lib/errors';

type LogEntry = {
  key: string;
  service_label: string;
  label: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  size_human: string;
  clearable: boolean;
};

type CleanupCategory = {
  key: string;
  label: string;
  description: string;
  risk: 'safe' | 'caution';
  size_bytes: number;
  count: number;
  samples: { path: string; size_bytes: number }[];
};

type Page = {
  server: Server;
  logs: LogEntry[];
};

function formatBytes(b: number): string {
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function SizeCell({ entry }: { entry: LogEntry }) {
  if (!entry.exists) return <span className="text-muted-foreground text-xs">File not found</span>;
  if (entry.size_bytes === 0) return <span className="text-muted-foreground text-xs">Empty</span>;

  const color =
    entry.size_bytes > 100 * 1024 * 1024 ? 'danger' :
    entry.size_bytes > 10 * 1024 * 1024 ? 'warning' : 'default';

  return <Badge variant={color as 'default'}>{entry.size_human}</Badge>;
}

function ClearAction({ entry, serverId }: { entry: LogEntry; serverId: number }) {
  const dialog = useDialog();

  if (!entry.exists || !entry.clearable) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
        <Trash2Icon className="size-4" />
        <span>Clear</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={() =>
        dialog.confirm.open({
          title: 'Clear Log File',
          description: `The log file "${entry.label}" will be cleared. This action cannot be undone.`,
          confirmLabel: 'Clear',
          method: 'post',
          url: `/servers/${serverId}/monitoring/log-rotation/clear`,
          data: { key: entry.key },
        })
      }
    >
      <Trash2Icon className="size-4" />
      <span>Clear</span>
    </Button>
  );
}

function CleanupSuggestions({ serverId }: { serverId: number }) {
  const dialog = useDialog();
  const [selected, setSelected] = useState<string[]>([]);

  const query = useQuery({
    queryKey: ['serverCleanup', serverId],
    queryFn: async () => {
      const response = await axios.get<{ categories: CleanupCategory[] }>(`/servers/${serverId}/monitoring/log-rotation/cleanup`);
      return response.data.categories;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const categories = query.data;

  useEffect(() => {
    if (categories) {
      setSelected(categories.filter((category) => category.risk === 'safe').map((category) => category.key));
    }
  }, [categories]);

  const toggle = (key: string, checked: boolean) => setSelected((prev) => (checked ? [...prev, key] : prev.filter((item) => item !== key)));

  const selectedBytes = (categories ?? []).filter((category) => selected.includes(category.key)).reduce((sum, category) => sum + category.size_bytes, 0);

  const cleanUp = () =>
    dialog.confirm.open({
      title: 'Clean up selected files',
      description: `About ${formatBytes(selectedBytes)} will be freed. Only logs and caches are removed, no application data. This action cannot be undone.`,
      confirmLabel: 'Clean up',
      variant: 'destructive',
      method: 'post',
      url: `/servers/${serverId}/monitoring/log-rotation/cleanup`,
      data: { categories: selected.join(',') },
      onSuccess: () => query.refetch(),
    });

  return (
    <div className="overflow-hidden rounded-md border shadow-xs">
      <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <BrushCleaningIcon className="text-muted-foreground size-4" />
          <span className="text-sm font-semibold">Cleanup suggestions</span>
          <span className="text-muted-foreground text-xs">Found by scanning the server for logs and caches</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCwIcon className={cn('size-4', query.isFetching && 'animate-spin')} />
            <span className="hidden sm:block">Rescan</span>
          </Button>
          <Button variant="destructive" size="sm" onClick={cleanUp} disabled={selected.length === 0 || query.isFetching}>
            <Trash2Icon className="size-4" />
            <span>Clean up{selectedBytes > 0 ? ` (${formatBytes(selectedBytes)})` : ''}</span>
          </Button>
        </div>
      </div>

      {query.isError ? (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription>{errorMessage(query.error, 'Failed to scan the server')}</AlertDescription>
        </Alert>
      ) : query.isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <LoaderCircleIcon className="size-3 animate-spin" />
            Scanning the server, this can take a few seconds...
          </p>
        </div>
      ) : categories && categories.length > 0 ? (
        <ul className="divide-y">
          {categories.map((category) => (
            <li key={category.key} className="flex items-start gap-3 px-4 py-3">
              <Checkbox
                id={`cleanup-${category.key}`}
                className="mt-1"
                checked={selected.includes(category.key)}
                onCheckedChange={(checked) => toggle(category.key, checked === true)}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={`cleanup-${category.key}`} className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {category.label}
                  {category.risk === 'caution' && <Badge variant="warning">Review first</Badge>}
                </label>
                <p className="text-muted-foreground text-xs">{category.description}</p>
                <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5">
                  {category.samples.map((sample) => (
                    <li key={sample.path} className="flex justify-between gap-3 font-mono text-xs">
                      <span className="truncate">{sample.path}</span>
                      <span className="shrink-0">{formatBytes(sample.size_bytes)}</span>
                    </li>
                  ))}
                  {category.count > category.samples.length && <li className="text-xs">and {category.count - category.samples.length} more</li>}
                </ul>
              </div>
              <Badge variant={category.size_bytes > 100 * 1024 * 1024 ? 'danger' : 'default'} className="shrink-0">
                {formatBytes(category.size_bytes)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground p-6 text-center text-sm">Nothing to clean up. No large or rotated logs and no caches were found.</p>
      )}
    </div>
  );
}

export default function LogRotation() {
  const { server, logs } = usePage<Page>().props;
  const dialog = useDialog();

  const clearable = logs.filter((l) => l.clearable);
  const totalSize = logs.reduce((sum, l) => sum + (l.exists ? l.size_bytes : 0), 0);

  const grouped = logs.reduce<Record<string, LogEntry[]>>((acc, log) => {
    if (!acc[log.service_label]) acc[log.service_label] = [];
    acc[log.service_label].push(log);
    return acc;
  }, {});

  const handleClearAll = () => {
    if (clearable.length === 0) return;
    dialog.confirm.open({
      title: 'Clear All Log Files',
      description: `${clearable.length} log files will be cleared (total ${formatBytes(totalSize)}). This action cannot be undone.`,
      confirmLabel: 'Clear All',
      method: 'post',
      url: `/servers/${server.id}/monitoring/log-rotation/clear-all`,
      data: {},
    });
  };

  return (
    <ServerLayout>
      <Head title={`Log Rotation - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading
            title="Log Rotation"
            description="View and rotate server and service log files"
          />
          <div className="flex items-center gap-2">
            {totalSize > 0 && (
              <span className="text-muted-foreground text-sm">
                Total: <strong>{formatBytes(totalSize)}</strong>
              </span>
            )}
            {clearable.length > 0 && (
              <Button variant="destructive" onClick={handleClearAll}>
                <Trash2Icon className="size-4" />
                <span>Clear All</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCwIcon className="size-4" />
              <span className="hidden lg:block">Refresh</span>
            </Button>
          </div>
        </HeaderContainer>

        <CleanupSuggestions serverId={server.id} />

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border p-16 text-center">
            <FileTextIcon className="text-muted-foreground mb-4 size-10" />
            <p className="text-muted-foreground">No log files found.</p>
            <p className="text-muted-foreground mt-1 text-sm">At least one service must be installed on the server.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([serviceLabel, entries]) => (
              <div key={serviceLabel} className="overflow-hidden rounded-md border shadow-xs">
                <div className="bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
                  <FileTextIcon className="text-muted-foreground size-4" />
                  <span className="text-sm font-semibold">{serviceLabel}</span>
                  <span className="text-muted-foreground text-xs">
                    ({entries.length} file{entries.length !== 1 ? 's' : ''})
                  </span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Log File</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="w-0">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.key} className={cn(!entry.exists && 'opacity-50')}>
                        <TableCell className="font-medium">{entry.label}</TableCell>
                        <TableCell>
                          <code className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs font-mono">
                            {entry.path}
                          </code>
                        </TableCell>
                        <TableCell><SizeCell entry={entry} /></TableCell>
                        <TableCell><ClearAction entry={entry} serverId={server.id} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </Container>
    </ServerLayout>
  );
}
