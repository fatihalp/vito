import { withQuery } from '@/lib/url';
import { Head, Link, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { DownloadIcon, EraserIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import DateTime from '@/components/date-time';
import { useDialog } from '@/hooks/use-dialog';
import ServiceLogViewer from './components/service-log-viewer';

type CatalogueItem = {
  key: string;
  service_label: string;
  label: string;
  display_target: string;
  source: 'file' | 'journal';
};

const LINE_OPTIONS = ['100', '200', '500', '1000', '2000'] as const;
type LineOption = (typeof LINE_OPTIONS)[number];

export default function ServiceLogs() {
  const page = usePage<{
    title: string;
    server: Server;
    catalogue: CatalogueItem[];
  }>();

  const { catalogue, server } = page.props;
  const dialog = useDialog();

  const itemsByKey = useMemo(() => Object.fromEntries(catalogue.map((c) => [c.key, c])), [catalogue]);

  const initialSelection = useMemo(() => {
    const params = new URLSearchParams(page.url.split('?')[1] ?? '');
    const keyParam = params.get('key');
    if (keyParam && itemsByKey[keyParam]) {
      return { service: itemsByKey[keyParam].service_label, key: keyParam };
    }

    const serviceParam = params.get('service')?.toLowerCase();
    if (serviceParam) {
      const serviceName = (server.services[serviceParam] ?? serviceParam).toLowerCase();
      const match = catalogue.find(
        (c) =>
          c.key.toLowerCase().split(':')[0] === serviceName ||
          c.service_label.toLowerCase() === serviceName,
      );
      return { service: match?.service_label ?? '', key: '' };
    }

    return { service: '', key: '' };
  }, [catalogue, itemsByKey, page.url, server.services]);

  const [selectedService, setSelectedService] = useState(initialSelection.service);
  const [selectedKey, setSelectedKey] = useState(initialSelection.key);
  const [lines, setLines] = useState<LineOption>('500');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [displayTarget, setDisplayTarget] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selected = selectedKey ? itemsByKey[selectedKey] : undefined;

  useEffect(() => {
    setSelectedService(initialSelection.service);
    setSelectedKey(initialSelection.key);
  }, [initialSelection.key, initialSelection.service]);

  const fetchLog = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setIsLoading(false);

    if (!selectedKey) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    axios
      .post(
        `/servers/${server.id}/logs/services/read`,
        { key: selectedKey, lines: Number(lines) },
        { signal: controller.signal },
      )
      .then((response) => {
        if (controller.signal.aborted) return;
        setContent(response.data.content ?? '');
        setDisplayTarget(response.data.display_target ?? '');
        setUpdatedAt(new Date().toISOString());
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        if (axios.isAxiosError(err)) {
          const msg = err.response?.data?.message || err.response?.data?.error || err.message;
          setError(msg || 'Failed to read log');
        } else {
          setError('Failed to read log');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
        if (abortRef.current === controller) abortRef.current = null;
      });
  }, [selectedKey, lines, server.id]);

  useEffect(() => {
    setContent('');
    setDisplayTarget('');
    setUpdatedAt(null);
    fetchLog();
    return () => abortRef.current?.abort();
  }, [fetchLog]);

  useEffect(() => {
    if (!autoRefresh || !selectedKey) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !abortRef.current) fetchLog();
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, selectedKey, fetchLog]);

  const downloadLog = useCallback(async () => {
    if (!selectedKey || isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await axios.get(withQuery(`/servers/${server.id}/logs/services/download`, { key: selectedKey }), {
        responseType: 'blob',
      });

      const disposition = response.headers['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `${selectedKey}.log`;

      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        let msg = err.message;
        const data = err.response?.data;
        if (data instanceof Blob) {
          const text = await data.text();
          try {
            const parsed = JSON.parse(text);
            msg = parsed.message || parsed.error || msg;
          } catch {
            msg = text || msg;
          }
        } else if (data?.message || data?.error) {
          msg = data.message || data.error;
        }
        setError(msg || 'Download failed');
      } else {
        setError('Download failed');
      }
    } finally {
      setIsDownloading(false);
    }
  }, [selectedKey, isDownloading, server.id]);

  const serviceItems = useMemo(
    () => [...new Set(catalogue.map((log) => log.service_label))].map((service) => ({ value: service, label: service })),
    [catalogue],
  );

  const comboItems = useMemo(
    () =>
      catalogue.filter((c) => c.service_label === selectedService).map((c) => ({
        value: c.key,
        label: c.label,
        keywords: [c.service_label, c.label, c.display_target],
      })),
    [catalogue, selectedService],
  );

  return (
    <ServerLayout>
      <Head title={`Service logs - ${server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading title="Service logs" description="Inspect recent log records, filter by severity and expand errors for full details." />
        </HeaderContainer>

        {catalogue.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground p-10 text-center text-sm">
              No services with logs are installed on this server yet.{' '}
              <Link href={`/servers/${server.id}/services`} className="text-foreground underline underline-offset-4">
                Manage services
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="gap-3">
              <div className="grid min-w-0 gap-4 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2 [&_[role=combobox]]:min-w-0 [&_[role=combobox]>span]:truncate">
                  <Label htmlFor="log-service">Service</Label>
                  <Combobox
                    id="log-service"
                    items={serviceItems}
                    value={selectedService}
                    placeholder="Select a service..."
                    searchText="Search services..."
                    noneFoundText="No matching service"
                    onValueChange={(service) => {
                      setSelectedService(service);
                      setSelectedKey('');
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2 [&_[role=combobox]]:min-w-0 [&_[role=combobox]>span]:truncate">
                  <Label htmlFor="service-log">Log</Label>
                  {selectedService ? (
                    <Combobox
                      id="service-log"
                      items={comboItems}
                      value={selectedKey}
                      placeholder="Select a log..."
                      searchText="Search logs..."
                      noneFoundText="No matching log"
                      onValueChange={setSelectedKey}
                    />
                  ) : (
                    <Button id="service-log" variant="outline" className="justify-start" disabled>
                      Select a service first
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex flex-1 items-center gap-2">
                  <Checkbox id="auto-refresh-logs" checked={autoRefresh} onCheckedChange={(checked) => setAutoRefresh(checked === true)} disabled={!selectedKey} />
                  <Label htmlFor="auto-refresh-logs" className="text-sm">Auto-refresh every 10s</Label>
                </div>
                <Select value={lines} onValueChange={(v) => setLines(v as LineOption)} disabled={!selectedKey}>
                  <SelectTrigger className="w-32" aria-label="Line count">
                    <SelectValue placeholder="Lines" />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n} lines
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchLog} disabled={!selectedKey || isLoading} title="Refresh" aria-label="Refresh">
                  {isLoading ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={downloadLog}
                  disabled={!selectedKey || isDownloading}
                  title="Download"
                  aria-label="Download log"
                >
                  {isDownloading ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
                </Button>
                {selected && selected.source === 'file' ? (
                  <Button
                    variant="outline"
                    size="icon"
                    title="Clear log"
                    aria-label="Clear log"
                    onClick={() => dialog.confirm.open({
                      title: 'Clear log',
                      description: `Clear all contents of ${selected.display_target}? This cannot be undone. The file and its permissions are preserved.`,
                      confirmLabel: 'Clear log',
                      variant: 'destructive',
                      method: 'post',
                      url: `/servers/${server.id}/logs/services/clear`,
                      data: { key: selected.key },
                      onSuccess: fetchLog,
                    })}
                  >
                    <EraserIcon />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon" disabled title="Journal logs cannot be cleared" aria-label="Clear log">
                    <EraserIcon />
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="bg-muted/40 text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-xs">
                <span className="min-w-0 font-mono break-all">{displayTarget || selected?.display_target || 'No log selected'}</span>
                {updatedAt && <span className="shrink-0">Updated <DateTime date={updatedAt} /></span>}
              </div>
              <ServiceLogViewer key={selectedKey} isLoading={isLoading} error={error} hasSelection={!!selectedKey} content={content} />
            </CardContent>
          </Card>
        )}
      </Container>
    </ServerLayout>
  );
}
