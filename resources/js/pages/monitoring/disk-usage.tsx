import React, { useCallback, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  CornerLeftUpIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  HardDriveIcon,
  PencilIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';

export type Breadcrumb = {
  name: string;
  path: string;
};

export type FolderEntry = {
  name: string;
  path: string;
  size: string;
  size_bytes: number;
  percentage: number;
};

export type FileEntry = {
  name: string;
  path: string;
  relative_path: string;
  relative_dir: string;
  size: string;
  size_bytes: number;
  percentage: number;
};

export type DiskUsageData = {
  folders: FolderEntry[];
  files: FileEntry[];
  path: string;
  parent_path: string | null;
  breadcrumbs: Breadcrumb[];
  target_size: string | null;
  target_size_bytes: number;
  error: string | null;
};

type PageProps = {
  server: Server;
  diskUsage: DiskUsageData;
};

const LIMIT_OPTIONS = [
  { value: '10', label: 'Top 10' },
  { value: '20', label: 'Top 20' },
  { value: '50', label: 'Top 50' },
];

const PRESET_PATHS = ['/', '/var', '/var/log', '/home', '/tmp', '/etc', '/usr'];

function SizeCell({ size, percentage }: { size: string; percentage: number }) {
  const isLarge = size.toUpperCase().includes('G');

  return (
    <div className="flex flex-col items-end justify-center gap-0.5">
      <span
        className={cn(
          'font-mono text-xs font-medium',
          isLarge ? 'text-amber-500 dark:text-amber-400 font-semibold' : 'text-foreground'
        )}
      >
        {size}
      </span>
      {percentage > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
          <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all', isLarge ? 'bg-amber-500/80' : 'bg-primary/70')}
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <span className="w-8 text-right">{percentage.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function BreadcrumbBar({
  breadcrumbs,
  parentPath,
  currentPath,
  loading,
  targetSize,
  onNavigate,
}: {
  breadcrumbs: Breadcrumb[];
  parentPath: string | null;
  currentPath: string;
  loading: boolean;
  targetSize: string | null;
  onNavigate: (path: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentPath);

  const handleEditOpen = () => {
    setInputValue(currentPath);
    setIsEditing(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = inputValue.trim() || '/';
    setIsEditing(false);
    onNavigate(sanitized);
  };

  const handleEditCancel = () => {
    setInputValue(currentPath);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border/50 bg-card p-2 shadow-2xs">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={!parentPath || loading}
                onClick={() => parentPath && onNavigate(parentPath)}
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                aria-label="Go up to parent directory"
              >
                <CornerLeftUpIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {parentPath ? `Go up to ${parentPath}` : 'At root directory'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border/60 shrink-0" />

        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="flex items-center gap-1.5 flex-1 min-w-0">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') handleEditCancel();
              }}
              autoFocus
              className="h-7 text-xs font-mono bg-background border-border/80 flex-1"
              placeholder="/path/to/folder..."
              aria-label="Target directory path"
            />
            <Button type="submit" size="sm" className="h-7 px-2.5 text-xs cursor-pointer">
              Go
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleEditCancel}
              aria-label="Cancel editing path"
            >
              <XIcon className="size-3.5" />
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto py-0.5 no-scrollbar">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const isRoot = crumb.path === '/';

              return (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && (
                    <ChevronRightIcon className="size-3 text-muted-foreground/40 shrink-0 select-none" />
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate(crumb.path)}
                    disabled={loading || isLast}
                    title={crumb.path}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs transition-colors shrink-0',
                      isLast
                        ? 'font-semibold text-foreground bg-muted/40 cursor-default'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer'
                    )}
                  >
                    {isRoot && <HardDriveIcon className="size-3 text-muted-foreground" />}
                    <span>{crumb.name === '/' ? 'root' : crumb.name}</span>
                  </button>
                </React.Fragment>
              );
            })}

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleEditOpen}
                    className="p-1 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer shrink-0 ml-1"
                    aria-label="Type path directly"
                  >
                    <PencilIcon className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Edit path directly</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {targetSize && (
        <div className="shrink-0 flex items-center gap-1.5 font-mono text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded border border-border/40 self-end sm:self-auto">
          <span>Total Size:</span>
          <span className="font-semibold text-foreground">{targetSize}</span>
        </div>
      )}
    </div>
  );
}

function QuickPresets({
  currentPath,
  loading,
  onSelect,
}: {
  currentPath: string;
  loading: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      <span className="text-[11px] font-medium text-muted-foreground mr-1">Quick scan:</span>
      {PRESET_PATHS.map((preset) => {
        const isActive = currentPath === preset;
        return (
          <button
            key={preset}
            type="button"
            disabled={loading}
            onClick={() => onSelect(preset)}
            className={cn(
              'rounded border px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer disabled:pointer-events-none',
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary font-semibold'
                : 'border-border/50 bg-muted/15 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

function FolderListCard({
  folders,
  loading,
  onDrillDown,
  onCopy,
  copiedPath,
}: {
  folders: FolderEntry[];
  loading: boolean;
  onDrillDown: (path: string) => void;
  onCopy: (path: string) => void;
  copiedPath: string | null;
}) {
  return (
    <Card className="overflow-hidden border-border/50 bg-card shadow-2xs">
      <CardHeader className="border-b border-border/40 bg-muted/10 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderIcon className="size-3.5 text-primary" />
            Largest Folders
          </CardTitle>
          <span className="text-[11px] text-muted-foreground font-mono">
            {folders.length} directories
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/5">
            <TableRow className="h-7 border-b border-border/40 hover:bg-transparent">
              <TableHead className="h-7 w-8 px-2 text-center text-[11px]">#</TableHead>
              <TableHead className="h-7 px-3 text-[11px]">Folder</TableHead>
              <TableHead className="h-7 w-28 px-3 text-right text-[11px]">Size</TableHead>
              <TableHead className="h-7 w-16 px-2 text-center text-[11px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  {loading ? 'Scanning directories...' : 'No subdirectories found in this location.'}
                </TableCell>
              </TableRow>
            ) : (
              folders.map((folder, i) => (
                <TableRow
                  key={folder.path}
                  onClick={() => onDrillDown(folder.path)}
                  className="h-8 border-b border-border/30 hover:bg-muted/25 transition-colors cursor-pointer group"
                >
                  <TableCell className="px-2 py-1 text-center font-mono text-[11px] text-muted-foreground/60">
                    {i + 1}
                  </TableCell>
                  <TableCell className="px-3 py-1">
                    <div className="flex items-center gap-1.5 min-w-0" title={folder.path}>
                      <FolderIcon className="size-3.5 text-primary/70 shrink-0 group-hover:text-primary transition-colors" />
                      <span className="font-mono text-xs font-medium text-foreground truncate group-hover:underline">
                        {folder.name}/
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1 text-right">
                    <SizeCell size={folder.size} percentage={folder.percentage} />
                  </TableCell>
                  <TableCell
                    className="px-2 py-1 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                              onClick={() => onDrillDown(folder.path)}
                              aria-label={`Open folder ${folder.path}`}
                            >
                              <FolderOpenIcon className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open folder</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                              onClick={() => onCopy(folder.path)}
                              aria-label={`Copy path ${folder.path}`}
                            >
                              {copiedPath === folder.path ? (
                                <CheckIcon className="size-3 text-emerald-500" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy full path</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FileListCard({
  files,
  loading,
  onCopy,
  copiedPath,
}: {
  files: FileEntry[];
  loading: boolean;
  onCopy: (path: string) => void;
  copiedPath: string | null;
}) {
  return (
    <Card className="overflow-hidden border-border/50 bg-card shadow-2xs">
      <CardHeader className="border-b border-border/40 bg-muted/10 px-4 py-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <FileIcon className="size-3.5 text-primary" />
            Largest Files
          </CardTitle>
          <span className="text-[11px] text-muted-foreground font-mono">
            {files.length} files
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/5">
            <TableRow className="h-7 border-b border-border/40 hover:bg-transparent">
              <TableHead className="h-7 w-8 px-2 text-center text-[11px]">#</TableHead>
              <TableHead className="h-7 px-3 text-[11px]">File</TableHead>
              <TableHead className="h-7 w-28 px-3 text-right text-[11px]">Size</TableHead>
              <TableHead className="h-7 w-12 px-2 text-center text-[11px]">Copy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                  {loading ? 'Scanning files...' : 'No files found in this directory.'}
                </TableCell>
              </TableRow>
            ) : (
              files.map((file, i) => (
                <TableRow
                  key={file.path}
                  className="h-8 border-b border-border/30 hover:bg-muted/25 transition-colors group"
                >
                  <TableCell className="px-2 py-1 text-center font-mono text-[11px] text-muted-foreground/60">
                    {i + 1}
                  </TableCell>
                  <TableCell className="px-3 py-1">
                    <div className="flex flex-col min-w-0" title={file.path}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileIcon className="size-3 text-muted-foreground/60 shrink-0" />
                        <span className="font-mono text-xs font-medium text-foreground truncate">
                          {file.name}
                        </span>
                      </div>
                      {file.relative_dir && (
                        <span className="font-mono text-[10px] text-muted-foreground/70 truncate pl-4.5">
                          {file.relative_dir}/
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1 text-right">
                    <SizeCell size={file.size} percentage={file.percentage} />
                  </TableCell>
                  <TableCell className="px-2 py-1 text-center">
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                            onClick={() => onCopy(file.path)}
                            aria-label={`Copy path ${file.path}`}
                          >
                            {copiedPath === file.path ? (
                              <CheckIcon className="size-3 text-emerald-500" />
                            ) : (
                              <CopyIcon className="size-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy full path</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function DiskUsage() {
  const { server, diskUsage: initialData } = usePage<PageProps>().props;
  const [data, setData] = useState<DiskUsageData>(initialData);
  const [limit, setLimit] = useState<string>('10');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { copy } = useClipboard();

  const handleCopy = (path: string) => {
    copy(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const fetchDiskUsage = useCallback(
    async (scanPath: string, scanLimit: string) => {
      setLoading(true);
      try {
        const jsonUrl = new URL(route('monitoring.disk-usage.json', { server: server.id }), window.location.origin);
        jsonUrl.searchParams.set('path', scanPath);
        jsonUrl.searchParams.set('limit', scanLimit);

        const res = await fetch(jsonUrl.toString(), {
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (res.ok) {
          const json: DiskUsageData = await res.json();
          setData(json);

          const pageUrl = new URL(route('monitoring.disk-usage', { server: server.id }), window.location.origin);
          pageUrl.searchParams.set('path', json.path);
          if (scanLimit !== '10') {
            pageUrl.searchParams.set('limit', scanLimit);
          }
          window.history.replaceState(null, '', pageUrl.toString());
        }
      } finally {
        setLoading(false);
      }
    },
    [server.id]
  );

  const handleNavigate = (path: string) => {
    fetchDiskUsage(path, limit);
  };

  const handleLimitChange = (newLimit: string) => {
    setLimit(newLimit);
    fetchDiskUsage(data.path, newLimit);
  };

  const handleRefresh = () => {
    fetchDiskUsage(data.path, limit);
  };

  return (
    <ServerLayout>
      <Head title={`Disk Usage - ${server.name}`} />

      <Container className="max-w-6xl space-y-3.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Heading
            title="Disk Usage"
            description="Explore largest files and folders across directories on this server"
          />

          <div className="flex items-center gap-1.5">
            <Select value={limit} onValueChange={handleLimitChange}>
              <SelectTrigger
                className="h-8 w-[88px] text-xs bg-muted/20 border-border/50 hover:bg-muted/40 cursor-pointer"
                aria-label="Item limit"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleRefresh}
                    className="size-8 shrink-0 bg-muted/20 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer"
                    disabled={loading}
                    aria-label="Refresh disk scan"
                  >
                    <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh current directory</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <BreadcrumbBar
          breadcrumbs={data.breadcrumbs || [{ name: '/', path: '/' }]}
          parentPath={data.parent_path}
          currentPath={data.path}
          loading={loading}
          targetSize={data.target_size}
          onNavigate={handleNavigate}
        />

        <QuickPresets
          currentPath={data.path}
          loading={loading}
          onSelect={handleNavigate}
        />

        {data.error && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2.5">
              <AlertCircleIcon className="size-4 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Unable to analyze disk</p>
                <p className="text-[11px] text-destructive/80 font-mono">{data.error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs cursor-pointer"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCwIcon className={cn('size-3', loading && 'animate-spin')} />
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FolderListCard
            folders={data.folders}
            loading={loading}
            onDrillDown={handleNavigate}
            onCopy={handleCopy}
            copiedPath={copiedPath}
          />

          <FileListCard
            files={data.files}
            loading={loading}
            onCopy={handleCopy}
            copiedPath={copiedPath}
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
          <HardDriveIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
          <span>
            Scans skip virtual mounts (<code className="text-foreground font-mono">/proc</code>, <code className="text-foreground font-mono">/sys</code>, <code className="text-foreground font-mono">/dev</code>) via filesystem boundary isolation (<code className="text-foreground font-mono">-xdev</code>).
          </span>
        </div>
      </Container>
    </ServerLayout>
  );
}
