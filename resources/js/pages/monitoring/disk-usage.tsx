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
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '50', label: '50' },
];

const PRESETS = ['/', '/var', '/home', '/tmp'];

function SizeCell({ size, percentage }: { size: string; percentage: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {percentage > 0 && (
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
          <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.min(100, percentage)}%` }}
            />
          </div>
          <span className="w-7 text-right">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <span className="font-mono text-xs font-medium text-foreground shrink-0">{size}</span>
    </div>
  );
}

export default function DiskUsage() {
  const { server, diskUsage: initialData } = usePage<PageProps>().props;
  const [data, setData] = useState<DiskUsageData>(initialData);
  const [limit, setLimit] = useState<string>('10');
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [pathInput, setPathInput] = useState<string>(initialData.path || '/');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { copy } = useClipboard();

  const handleCopy = (path: string) => {
    copy(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
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
          setPathInput(json.path);

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
    setIsEditing(false);
    fetchDiskUsage(path, limit);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = pathInput.trim() || '/';
    setIsEditing(false);
    fetchDiskUsage(sanitized, limit);
  };

  const breadcrumbs = data.breadcrumbs && data.breadcrumbs.length > 0 ? data.breadcrumbs : [{ name: '/', path: '/' }];

  return (
    <ServerLayout>
      <Head title={`Disk Usage - ${server.name}`} />

      <Container className="max-w-6xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Heading title="Disk Usage" />

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={loading}
                  onClick={() => handleNavigate(preset)}
                  className={cn(
                    'rounded px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer',
                    data.path === preset
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border/60 mx-0.5" />

            <Select
              value={limit}
              onValueChange={(val) => {
                setLimit(val);
                fetchDiskUsage(data.path, val);
              }}
            >
              <SelectTrigger
                className="h-7 w-[60px] text-xs bg-muted/20 border-border/50 hover:bg-muted/40 cursor-pointer"
                aria-label="Limit"
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
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchDiskUsage(data.path, limit)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                    disabled={loading}
                    aria-label="Refresh"
                  >
                    <RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!data.parent_path || loading}
                    onClick={() => data.parent_path && handleNavigate(data.parent_path)}
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    aria-label="Up"
                  >
                    <CornerLeftUpIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{data.parent_path ? `Up to ${data.parent_path}` : 'Root'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-3.5 w-px bg-border/60 shrink-0" />

            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsEditing(false);
                  }}
                  autoFocus
                  className="h-6 text-xs font-mono bg-background border-border/80 flex-1"
                  placeholder="/"
                />
                <Button type="submit" size="sm" className="h-6 px-2 text-[11px] cursor-pointer">
                  Go
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setIsEditing(false)}
                >
                  <XIcon className="size-3" />
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
                        onClick={() => handleNavigate(crumb.path)}
                        disabled={loading || isLast}
                        className={cn(
                          'inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-xs transition-colors shrink-0',
                          isLast
                            ? 'font-medium text-foreground bg-muted/40 cursor-default'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer'
                        )}
                      >
                        {isRoot && <HardDriveIcon className="size-3 text-muted-foreground" />}
                        <span>{crumb.name === '/' ? 'root' : crumb.name}</span>
                      </button>
                    </React.Fragment>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setPathInput(data.path);
                    setIsEditing(true);
                  }}
                  className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer shrink-0 ml-1"
                  aria-label="Edit"
                >
                  <PencilIcon className="size-2.5" />
                </button>
              </div>
            )}
          </div>

          {data.target_size && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {data.target_size}
            </span>
          )}
        </div>

        {data.error && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span className="font-mono">{data.error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs cursor-pointer"
              onClick={() => fetchDiskUsage(data.path, limit)}
              disabled={loading}
            >
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <Card className="overflow-hidden border-border/50 bg-card shadow-2xs">
            <CardHeader className="border-b border-border/40 bg-muted/10 px-3.5 py-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FolderIcon className="size-3.5 text-primary" />
                  Folders
                </CardTitle>
                <span className="text-[11px] text-muted-foreground/70 font-mono">
                  {data.folders.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow className="h-7 border-b border-border/40 hover:bg-transparent">
                    <TableHead className="h-7 px-3 text-[11px]">Name</TableHead>
                    <TableHead className="h-7 w-28 px-3 text-right text-[11px]">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.folders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-20 text-center text-xs text-muted-foreground">
                        {loading ? 'Scanning...' : 'No subdirectories'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.folders.map((folder) => (
                      <TableRow
                        key={folder.path}
                        onClick={() => handleNavigate(folder.path)}
                        className="h-8 border-b border-border/30 hover:bg-muted/25 transition-colors cursor-pointer group"
                      >
                        <TableCell className="px-3 py-1">
                          <div className="flex items-center gap-1.5 min-w-0" title={folder.path}>
                            <FolderIcon className="size-3.5 text-primary/70 shrink-0 group-hover:text-primary transition-colors" />
                            <span className="font-mono text-xs font-medium text-foreground truncate group-hover:underline">
                              {folder.name}/
                            </span>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/50 hover:text-foreground cursor-pointer ml-auto shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(folder.path);
                              }}
                              aria-label="Copy"
                            >
                              {copiedPath === folder.path ? (
                                <CheckIcon className="size-3 text-emerald-500" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-right">
                          <SizeCell size={folder.size} percentage={folder.percentage} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/50 bg-card shadow-2xs">
            <CardHeader className="border-b border-border/40 bg-muted/10 px-3.5 py-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FileIcon className="size-3.5 text-primary" />
                  Files
                </CardTitle>
                <span className="text-[11px] text-muted-foreground/70 font-mono">
                  {data.files.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/5">
                  <TableRow className="h-7 border-b border-border/40 hover:bg-transparent">
                    <TableHead className="h-7 px-3 text-[11px]">Name</TableHead>
                    <TableHead className="h-7 w-28 px-3 text-right text-[11px]">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.files.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-20 text-center text-xs text-muted-foreground">
                        {loading ? 'Scanning...' : 'No files'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.files.map((file) => (
                      <TableRow
                        key={file.path}
                        className="h-8 border-b border-border/30 hover:bg-muted/25 transition-colors group"
                      >
                        <TableCell className="px-3 py-1">
                          <div className="flex items-center gap-1.5 min-w-0" title={file.path}>
                            <FileIcon className="size-3 text-muted-foreground/60 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-mono text-xs font-medium text-foreground truncate">
                                {file.name}
                              </span>
                              {file.relative_dir && (
                                <span className="font-mono text-[10px] text-muted-foreground/60 truncate">
                                  {file.relative_dir}/
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/50 hover:text-foreground cursor-pointer ml-auto shrink-0"
                              onClick={() => handleCopy(file.path)}
                              aria-label="Copy"
                            >
                              {copiedPath === file.path ? (
                                <CheckIcon className="size-3 text-emerald-500" />
                              ) : (
                                <CopyIcon className="size-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-right">
                          <SizeCell size={file.size} percentage={file.percentage} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </Container>
    </ServerLayout>
  );
}
