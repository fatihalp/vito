import { useEffect, useMemo, useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowUpDownIcon,
  EraserIcon,
  FileTextIcon,
  FilterIcon,
  InfoIcon,
  RefreshCwIcon,
  SearchIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  command: string;
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
  if (!entry.exists) return <span className="text-muted-foreground text-xs">Missing</span>;
  if (entry.size_bytes === 0) return <span className="text-muted-foreground text-xs">0 B</span>;

  return (
    <span
      className={cn(
        'font-mono text-xs tabular-nums',
        entry.size_bytes > 500 * 1024 * 1024
          ? 'font-semibold text-destructive'
          : entry.size_bytes > 50 * 1024 * 1024
            ? 'font-medium text-foreground'
            : 'text-muted-foreground',
      )}
    >
      {entry.size_human}
    </span>
  );
}

function ClearAction({ entry, serverId }: { entry: LogEntry; serverId: number }) {
  const dialog = useDialog();

  if (!entry.exists || !entry.clearable) {
    return (
      <Button variant="ghost" size="icon" disabled className="size-7 opacity-20">
        <Trash2Icon className="size-3.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
      title={`Clear ${entry.label}`}
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
      <Trash2Icon className="size-3.5" />
    </Button>
  );
}

function CleanupSuggestions({ serverId }: { serverId: number }) {
  const [selected, setSelected] = useState<string[]>([]);
  const dialog = useDialog();

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

  const toggle = (key: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((item) => item !== key)));

  const selectAll = () => {
    if (!categories) return;
    if (selected.length === categories.length) {
      setSelected([]);
    } else {
      setSelected(categories.map((c) => c.key));
    }
  };

  const selectedBytes = (categories ?? [])
    .filter((category) => selected.includes(category.key))
    .reduce((sum, category) => sum + category.size_bytes, 0);

  const commands = (categories ?? [])
    .filter((category) => selected.includes(category.key))
    .map((category) => `# ${category.label}\n${category.command}`)
    .join('\n\n');

  const openCommandsModal = () => {
    if (selected.length === 0) return;
    dialog.cleanupCommands.open({ commands, selectedBytes });
  };

  return (
    <div className="overflow-hidden rounded-md border shadow-xs bg-card min-w-0">
      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <EraserIcon className="text-muted-foreground size-4 shrink-0" />
          <span className="text-sm font-semibold">Cleanup suggestions</span>
          <span className="text-muted-foreground hidden sm:inline text-xs">
            Scan results from server. Vito never deletes anything itself.
          </span>
          {selectedBytes > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              ({formatBytes(selectedBytes)} selected)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {categories && categories.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAll}>
              {selected.length === categories.length ? 'Deselect all' : 'Select all'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCwIcon className={cn('size-3.5', query.isFetching && 'animate-spin')} />
            <span className="hidden sm:inline">Rescan</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={openCommandsModal}
            disabled={selected.length === 0 || query.isFetching}
          >
            <TerminalIcon className="size-3.5" />
            <span>Show commands{selectedBytes > 0 ? ` (${formatBytes(selectedBytes)})` : ''}</span>
          </Button>
        </div>
      </div>

      {query.isError ? (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription>{errorMessage(query.error, 'Failed to scan the server')}</AlertDescription>
        </Alert>
      ) : query.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3">
          {categories.map((category) => {
            const isChecked = selected.includes(category.key);

            return (
              <div
                key={category.key}
                onClick={() => toggle(category.key, !isChecked)}
                className={cn(
                  'flex cursor-pointer flex-col justify-between rounded-lg border p-3 transition-colors min-w-0',
                  isChecked
                    ? 'border-border bg-muted/40 shadow-xs'
                    : 'border-border/60 bg-card hover:bg-muted/20 opacity-70',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Checkbox
                        id={`cleanup-${category.key}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => toggle(category.key, checked === true)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <label
                        htmlFor={`cleanup-${category.key}`}
                        className="truncate text-xs font-medium cursor-pointer"
                        title={category.label}
                      >
                        {category.label}
                      </label>
                    </div>
                    <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-foreground">
                      {formatBytes(category.size_bytes)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px] line-clamp-1" title={category.description}>
                    {category.description}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]">
                  {category.risk === 'caution' ? (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal border-border">
                      Review first
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      {category.count} file{category.count !== 1 ? 's' : ''}
                    </span>
                  )}

                  {category.samples.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <InfoIcon className="size-3" />
                          <span>Sample files ({category.samples.length})</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-80 p-3 text-xs" onClick={(e) => e.stopPropagation()}>
                        <p className="font-semibold text-xs mb-1.5">{category.label} samples</p>
                        <ul className="space-y-1.5 font-mono text-[11px] max-h-48 overflow-auto">
                          {category.samples.map((sample) => (
                            <li key={sample.path} className="flex justify-between gap-2 border-b pb-1 last:border-0">
                              <span className="truncate text-muted-foreground" title={sample.path}>{sample.path}</span>
                              <span className="shrink-0 font-medium">{formatBytes(sample.size_bytes)}</span>
                            </li>
                          ))}
                        </ul>
                        {category.count > category.samples.length && (
                          <p className="text-[10px] text-muted-foreground mt-1.5 pt-1 border-t">
                            and {category.count - category.samples.length} more files
                          </p>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground p-6 text-center text-sm">Nothing to clean up. No large or rotated logs and no caches were found.</p>
      )}
    </div>
  );
}

export default function LogRotation() {
  const { server, logs } = usePage<Page>().props;
  const dialog = useDialog();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [sortBySize, setSortBySize] = useState(true);

  const clearable = logs.filter((l) => l.clearable);
  const totalSize = logs.reduce((sum, l) => sum + (l.exists ? l.size_bytes : 0), 0);

  const grouped = useMemo(() => {
    return logs.reduce<Record<string, LogEntry[]>>((acc, log) => {
      if (!acc[log.service_label]) acc[log.service_label] = [];
      acc[log.service_label].push(log);
      return acc;
    }, {});
  }, [logs]);

  const serviceTabs = useMemo(() => {
    const list = [
      {
        key: 'all',
        label: 'All',
        count: logs.length,
      },
    ];

    Object.entries(grouped).forEach(([label, entries]) => {
      list.push({
        key: label,
        label,
        count: entries.length,
      });
    });

    return list;
  }, [grouped, logs.length]);

  const filteredLogs = useMemo(() => {
    let list = activeTab === 'all' ? logs : (grouped[activeTab] || []);

    if (hideEmpty) {
      list = list.filter((l) => l.exists && l.size_bytes > 0);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.label.toLowerCase().includes(q) ||
          l.path.toLowerCase().includes(q) ||
          l.service_label.toLowerCase().includes(q),
      );
    }

    if (sortBySize) {
      list = [...list].sort((a, b) => {
        const sizeA = a.exists ? a.size_bytes : -1;
        const sizeB = b.exists ? b.size_bytes : -1;
        return sizeB - sizeA;
      });
    }

    return list;
  }, [activeTab, logs, grouped, hideEmpty, search, sortBySize]);

  const filteredTotalSize = useMemo(() => {
    return filteredLogs.reduce((sum, l) => sum + (l.exists ? l.size_bytes : 0), 0);
  }, [filteredLogs]);

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

      <Container>
        <HeaderContainer>
          <Heading
            title="Log Rotation"
            description="View and rotate server and service log files"
          />
          <div className="flex items-center gap-2">
            {totalSize > 0 && (
              <span className="text-muted-foreground text-sm">
                Total: <strong className="text-foreground">{formatBytes(totalSize)}</strong>
              </span>
            )}
            {clearable.length > 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleClearAll}
              >
                <Trash2Icon className="size-4" />
                <span>Clear All</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => router.reload()}>
              <RefreshCwIcon className="size-4" />
              <span className="hidden sm:inline">Refresh</span>
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
          <div className="overflow-hidden rounded-md border shadow-xs bg-card min-w-0">
            {/* Service Tabs */}
            <div className="border-b px-4 pt-3 pb-0 bg-muted/20">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
                  <TabsList className="h-8 gap-1 p-1">
                    {serviceTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="h-6 gap-1 px-2.5 text-xs font-medium"
                      >
                        <span>{tab.label}</span>
                        <span className="text-muted-foreground text-[10px]">({tab.count})</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Tabs>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 bg-muted/10">
              <div className="flex flex-1 items-center gap-2 min-w-48 max-w-sm">
                <div className="relative w-full">
                  <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search logs by name or path..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                    >
                      <XIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Switch
                    id="hide-empty"
                    checked={hideEmpty}
                    onCheckedChange={setHideEmpty}
                  />
                  <Label htmlFor="hide-empty" className="text-xs cursor-pointer">
                    Hide empty / missing
                  </Label>
                </div>

                <Button
                  variant={sortBySize ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setSortBySize(!sortBySize)}
                >
                  <ArrowUpDownIcon className="size-3" />
                  <span>{sortBySize ? 'Largest first' : 'Default order'}</span>
                </Button>

                <span className="text-muted-foreground text-xs hidden sm:inline">
                  Showing <strong>{filteredLogs.length}</strong> of {logs.length} (<strong>{formatBytes(filteredTotalSize)}</strong>)
                </span>
              </div>
            </div>

            {/* Compact Table */}
            <div className="max-h-[540px] overflow-auto min-w-0">
              <Table className="table-fixed w-full">
                <TableHeader className="sticky top-0 bg-card shadow-xs z-10">
                  <TableRow>
                    {activeTab === 'all' && <TableHead className="w-28">Service</TableHead>}
                    <TableHead className="w-56 md:w-72">Log File</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="w-24 text-right">Size</TableHead>
                    <TableHead className="w-14 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((entry) => (
                      <TableRow key={entry.key} className={cn(!entry.exists && 'opacity-50')}>
                        {activeTab === 'all' && (
                          <TableCell className="text-muted-foreground text-xs min-w-0 truncate">
                            {entry.service_label}
                          </TableCell>
                        )}
                        <TableCell className="min-w-0">
                          <div className="truncate font-medium text-xs text-foreground" title={entry.label}>
                            {entry.label}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-0">
                          <code className="text-muted-foreground block truncate text-xs font-mono select-all" title={entry.path}>
                            {entry.path}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">
                          <SizeCell entry={entry} />
                        </TableCell>
                        <TableCell className="text-right">
                          <ClearAction entry={entry} serverId={server.id} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={activeTab === 'all' ? 5 : 4} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                          <FilterIcon className="size-5" />
                          <p className="text-sm">No log files match your filters.</p>
                          {(search || hideEmpty) && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs h-auto p-0"
                              onClick={() => {
                                setSearch('');
                                setHideEmpty(false);
                              }}
                            >
                              Reset filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Container>
    </ServerLayout>
  );
}
