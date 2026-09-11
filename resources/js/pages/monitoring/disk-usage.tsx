import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Loader2Icon,
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
import { Skeleton } from '@/components/ui/skeleton';
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
  initialPath?: string;
  initialLimit?: number;
  initialBreadcrumbs?: Breadcrumb[];
  initialParentPath?: string | null;
  diskUsage?: DiskUsageData | null;
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
  const {
    server,
    initialPath = '/',
    initialLimit = 10,
    initialBreadcrumbs,
    initialParentPath,
    diskUsage: serverProvidedData,
  } = usePage<PageProps>().props;

  const [data, setData] = useState<DiskUsageData | null>(serverProvidedData ?? null);
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [limit, setLimit] = useState<string>(String(initialLimit));
  const [loading, setLoading] = useState<boolean>(!serverProvidedData);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [pathInput, setPathInput] = useState<string>(initialPath);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { copy } = useClipboard();

  const handleCopy = (path: string) => {
    copy(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  const breadcrumbs = useMemo(() => {
    if (data?.breadcrumbs && data.breadcrumbs.length > 0) {
      return data.breadcrumbs;
    }
    if (initialBreadcrumbs && initialBreadcrumbs.length > 0) {
      return initialBreadcrumbs;
    }
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs: Breadcrumb[] = [{ name: '/', path: '/' }];
    let acc = '';
    for (const part of parts) {
      acc += '/' + part;
      crumbs.push({ name: part, path: acc });
    }
    return crumbs;
  }, [data?.breadcrumbs, initialBreadcrumbs, currentPath]);

  const parentPath = useMemo(() => {
    if (data?.parent_path !== undefined) {
      return data.parent_path;
    }
    if (initialParentPath !== undefined) {
      return initialParentPath;
    }
    if (currentPath === '/') {
      return null;
    }
    const idx = currentPath.lastIndexOf('/');
    return idx <= 0 ? '/' : currentPath.substring(0, idx);
  }, [data?.parent_path, initialParentPath, currentPath]);

  const fetchDiskUsage = useCallback(
    async (scanPath: string, scanLimit: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setCurrentPath(scanPath);
      setPathInput(scanPath);

      try {
        const jsonUrl = new URL(route('monitoring.disk-usage.json', { server: server.id }), window.location.origin);
        jsonUrl.searchParams.set('path', scanPath);
        jsonUrl.searchParams.set('limit', scanLimit);

        const res = await fetch(jsonUrl.toString(), {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (res.ok) {
          const json: DiskUsageData = await res.json();
          setData(json);
          setCurrentPath(json.path);
          setPathInput(json.path);

          const pageUrl = new URL(route('monitoring.disk-usage', { server: server.id }), window.location.origin);
          pageUrl.searchParams.set('path', json.path);
          if (scanLimit !== '10') {
            pageUrl.searchParams.set('limit', scanLimit);
          }
          window.history.replaceState(null, '', pageUrl.toString());
        } else {
          setData((prev) => ({
            folders: prev?.folders ?? [],
            files: prev?.files ?? [],
            path: scanPath,
            parent_path: prev?.parent_path ?? null,
            breadcrumbs: prev?.breadcrumbs ?? [{ name: '/', path: '/' }],
            target_size: prev?.target_size ?? null,
            target_size_bytes: prev?.target_size_bytes ?? 0,
            error: `Failed to load disk usage (HTTP ${res.status}).`,
          }));
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setData((prev) => ({
          folders: prev?.folders ?? [],
          files: prev?.files ?? [],
          path: scanPath,
          parent_path: prev?.parent_path ?? null,
          breadcrumbs: prev?.breadcrumbs ?? [{ name: '/', path: '/' }],
          target_size: prev?.target_size ?? null,
          target_size_bytes: prev?.target_size_bytes ?? 0,
          error: err instanceof Error ? err.message : 'Unknown error occurred.',
        }));
      } finally {
        setLoading(false);
      }
    },
    [server.id]
  );

  useEffect(() => {
    if (!serverProvidedData) {
      fetchDiskUsage(initialPath, String(initialLimit));
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDiskUsage, initialLimit, initialPath, serverProvidedData]);

  const handleNavigate = (targetPath: string) => {
    setIsEditing(false);
    fetchDiskUsage(targetPath, limit);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = pathInput.trim() || '/';
    setIsEditing(false);
    fetchDiskUsage(sanitized, limit);
  };

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
                    'rounded px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer disabled:opacity-50',
                    currentPath === preset
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
              disabled={loading}
              onValueChange={(val) => {
                setLimit(val);
                fetchDiskUsage(currentPath, val);
              }}
            >
              <SelectTrigger
                className="h-7 w-[60px] text-xs bg-muted/20 border-border/50 hover:bg-muted/40 cursor-pointer disabled:opacity-50"
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
                    onClick={() => fetchDiskUsage(currentPath, limit)}
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
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
                    disabled={!parentPath || loading}
                    onClick={() => parentPath && handleNavigate(parentPath)}
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    aria-label="Up"
                  >
                    <CornerLeftUpIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{parentPath ? `Up to ${parentPath}` : 'Root'}</TooltipContent>
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
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 cursor-pointer disabled:opacity-50'
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
                  disabled={loading}
                  onClick={() => {
                    setPathInput(currentPath);
                    setIsEditing(true);
                  }}
                  className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer shrink-0 ml-1 disabled:opacity-30"
                  aria-label="Edit"
                >
                  <PencilIcon className="size-2.5" />
                </button>
              </div>
            )}
          </div>

          {data?.target_size && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {data.target_size}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2Icon className="size-4 animate-spin text-primary shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="font-medium">Analyzing disk usage...</span>
                <span className="text-muted-foreground hidden sm:inline truncate">
                  Scanning <code className="font-mono text-foreground text-[11px] px-1 py-0.5 bg-muted/60 rounded">{currentPath}</code> on {server.name}. This may take a moment on large disks.
                </span>
              </div>
            </div>
          </div>
        )}

        {data?.error && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span className="font-mono">{data.error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs cursor-pointer"
              onClick={() => fetchDiskUsage(currentPath, limit)}
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
                  {loading ? '...' : (data?.folders.length ?? 0)}
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
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="h-8 border-b border-border/30">
                        <TableCell className="px-3 py-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="size-3.5 rounded shrink-0" />
                            <Skeleton
                              className="h-3.5 rounded"
                              style={{ width: `${35 + ((i * 11) % 40)}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-right">
                          <div className="flex justify-end">
                            <Skeleton className="h-3.5 w-12 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !data || data.folders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-20 text-center text-xs text-muted-foreground">
                        No subdirectories
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
                  {loading ? '...' : (data?.files.length ?? 0)}
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
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="h-8 border-b border-border/30">
                        <TableCell className="px-3 py-1">
                          <div className="flex items-center gap-2">
                            <Skeleton className="size-3 rounded shrink-0" />
                            <div className="flex flex-col gap-1 w-full">
                              <Skeleton
                                className="h-3 rounded"
                                style={{ width: `${30 + ((i * 13) % 45)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 py-1 text-right">
                          <div className="flex justify-end">
                            <Skeleton className="h-3.5 w-12 rounded" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : !data || data.files.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="h-20 text-center text-xs text-muted-foreground">
                        No files
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
