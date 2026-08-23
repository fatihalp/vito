import { Head, usePage } from '@inertiajs/react';
import { FileTextIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDialog } from '@/hooks/use-dialog';
import { cn } from '@/lib/utils';

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
  if (!entry.exists) return <span className="text-muted-foreground text-xs">Dosya yok</span>;
  if (entry.size_bytes === 0) return <span className="text-muted-foreground text-xs">Boş</span>;

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
        <span>Temizle</span>
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
          title: 'Log Dosyasını Temizle',
          description: `"${entry.label}" adlı log dosyası temizlenecek. Bu işlem geri alınamaz.`,
          confirmLabel: 'Temizle',
          method: 'post',
          url: route('monitoring.log-rotation.clear', { server: serverId }),
          data: { key: entry.key },
        })
      }
    >
      <Trash2Icon className="size-4" />
      <span>Temizle</span>
    </Button>
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
      title: 'Tüm Log Dosyalarını Temizle',
      description: `${clearable.length} adet log dosyası temizlenecek (toplam ${formatBytes(totalSize)}). Bu işlem geri alınamaz.`,
      confirmLabel: 'Tümünü Temizle',
      method: 'post',
      url: route('monitoring.log-rotation.clear-all', { server: server.id }),
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
            description="Sunucu ve site log dosyalarını görüntüleyin ve temizleyin"
          />
          <div className="flex items-center gap-2">
            {totalSize > 0 && (
              <span className="text-muted-foreground text-sm">
                Toplam: <strong>{formatBytes(totalSize)}</strong>
              </span>
            )}
            {clearable.length > 0 && (
              <Button variant="destructive" onClick={handleClearAll}>
                <Trash2Icon className="size-4" />
                <span>Tümünü Temizle</span>
              </Button>
            )}
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCwIcon className="size-4" />
              <span className="hidden lg:block">Yenile</span>
            </Button>
          </div>
        </HeaderContainer>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border p-16 text-center">
            <FileTextIcon className="text-muted-foreground mb-4 size-10" />
            <p className="text-muted-foreground">Gösterilecek log dosyası bulunamadı.</p>
            <p className="text-muted-foreground mt-1 text-sm">Sunucuda en az bir servis kurulu olmalıdır.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([serviceLabel, entries]) => (
              <div key={serviceLabel} className="overflow-hidden rounded-md border shadow-xs">
                <div className="bg-muted/40 flex items-center gap-2 border-b px-4 py-2.5">
                  <FileTextIcon className="text-muted-foreground size-4" />
                  <span className="text-sm font-semibold">{serviceLabel}</span>
                  <span className="text-muted-foreground text-xs">({entries.length} dosya)</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Log Dosyası</TableHead>
                      <TableHead>Yol</TableHead>
                      <TableHead>Boyut</TableHead>
                      <TableHead className="w-0">İşlem</TableHead>
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
