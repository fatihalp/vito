import { useEffect, useMemo, useState } from 'react';
import { Head, usePage, router } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowUpDownIcon,
  CheckIcon,
  CopyIcon,
  EraserIcon,
  FileTextIcon,
  FilterIcon,
  InfoIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  SearchIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';
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
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground h-7 px-2">
        <Trash2Icon className="size-3.5" />
        <span className="text-xs">Clear</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-destructive hover:text-destructive h-7 px-2"
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
      <span className="text-xs">Clear</span>
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
    <div className="overflow-hidden rounded-md border shadow-xs bg-card">
      <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <EraserIcon className="text-muted-foreground size-4" />
          <span className="text-sm font-semibold">Cleanup suggestions</span>
          <span className="text-muted-foreground hidden sm:inline text-xs">
            Scan results from server. Vito never deletes anything itself.
          </span>
          {selectedBytes > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              {formatBytes(selectedBytes)} selected
            </Badge>
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
            <span className="hidden sm:block">Rescan</span>
          </Button>
          <Button
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
                  'flex cursor-pointer flex-col justify-between rounded-lg border p-3 transition-colors',
                  isChecked ? 'border-primary/50 bg-primary/5' : 'bg-card hover:bg-muted/40',
                )}
              >
                <div>
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
                        className="truncate text-xs font-semibold cursor-pointer"
                        title={category.label}
                      >
                        {category.label}
                      </label>
                    </div>
                    <Badge
                      variant={category.size_bytes > 100 * 1024 * 1024 ? 'danger' : 'default'}
                      className="shrink-0 text-[11px]"
                    >
                      {formatBytes(category.size_bytes)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px] line-clamp-1" title={category.description}>
                    {category.description}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px]">
                  {category.risk === 'caution' ? (
                    <Badge variant="warning" className="text-[10px] px-1 py-0">Review first</Badge>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">{category.count} file{category.count !== 1 ? 's' : ''}</span>
                  )}

                  {category.samples.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1 cursor-pointer"
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
        label: 'All Services',
        count: logs.length,
        size: totalSize,
      },
    ];

    Object.entries(grouped).forEach(([label, entries]) => {
      const size = entries.reduce((sum, l) => sum + (l.exists ? l.size_bytes : 0), 0);
      list.push({
        key: label,
        label,
        count: entries.length,
        size,
      });
    });

    return list;
  }, [grouped, logs.length, totalSize]);

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
                Total: <strong>{formatBytes(totalSize)}</strong>
              </span>
            )}
            {clearable.length > 0 && (
              <Button variant="destructive" onClick={handleClearAll}>
                <Trash2Icon className="size-4" />
                <span>Clear All</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => router.reload()}>
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
          <div className="overflow-hidden rounded-md border shadow-xs bg-card">
            {/* Service Tabs */}
            <div className="border-b px-4 pt-3 pb-0 bg-muted/20">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
                  <TabsList className="h-8 gap-1 p-1">
                    {serviceTabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="h-6 gap-1.5 px-2.5 text-xs font-medium"
                      >
                        <span>{tab.label}</span>
                        <span className="text-muted-foreground text-[10px]">({tab.count})</span>
                        {tab.size > 0 && (
                          <Badge variant="secondary" className="px-1 py-0 text-[9px] font-mono">
                            {formatBytes(tab.size)}
                          </Badge>
                        )}
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
            <div className="max-h-[540px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card shadow-xs z-10">
                  <TableRow>
                    {activeTab === 'all' && <TableHead className="w-32">Service</TableHead>}
                    <TableHead className="w-64">Log File</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="w-32 text-right">Size</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((entry) => (
                      <TableRow key={entry.key} className={cn(!entry.exists && 'opacity-50')}>
                        {activeTab === 'all' && (
                          <TableCell className="font-medium text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {entry.service_label}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="font-medium text-xs">
                          {entry.label}
                        </TableCell>
                        <TableCell>
                          <code className="text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 text-xs font-mono select-all">
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
