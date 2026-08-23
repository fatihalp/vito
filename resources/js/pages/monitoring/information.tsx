import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { ChevronDownIcon, ChevronUpIcon, ClipboardIcon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';

type Processor = {
  index: number;
  vendor: string;
  name: string;
  speed: string;
  cache: string;
};

type SystemInfo = {
  hostname: string;
  kernel: string;
  os: string;
  uptime: string;
  arch: string;
  raw_uname: string;
};

type MemoryInfo = {
  total: string;
  used: string;
  free: string;
  shared: string;
  buff_cache: string;
  available: string;
  swap_total: string;
  swap_used: string;
  swap_free: string;
  usage_percent: number;
  swap_usage_percent: number;
  raw_free: string;
};

type DiskEntry = {
  filesystem: string;
  size: string;
  used: string;
  avail: string;
  use_percent: string;
  mounted_on: string;
};

type InfoData = {
  processors: Processor[];
  total_processors: number;
  system: SystemInfo;
  memory: MemoryInfo;
  disks: DiskEntry[];
  raw_report: string;
  error?: string;
};

type Page = {
  server: Server;
  info: InfoData;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-mono break-all">{value || '-'}</span>
    </div>
  );
}

function UsageBar({ percent, label }: { percent: number; label: string }) {
  const color = percent >= 80 ? 'bg-destructive' : percent >= 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percent}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border shadow-xs overflow-hidden">
      <div className="bg-muted/40 border-b px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function Information() {
  const { server, info } = usePage<Page>().props;
  const [showRaw, setShowRaw] = useState(false);

  const copyRaw = () => {
    navigator.clipboard.writeText(info.raw_report).catch(() => {});
  };

  if (info.error) {
    return (
      <ServerLayout>
        <Head title={`Server Information - ${server.name}`} />
        <Container className="max-w-4xl">
          <HeaderContainer>
            <Heading title="Server Information" description="Hardware and system details for this server" />
          </HeaderContainer>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {info.error}
          </div>
        </Container>
      </ServerLayout>
    );
  }

  return (
    <ServerLayout>
      <Head title={`Server Information - ${server.name}`} />

      <Container className="max-w-4xl">
        <HeaderContainer>
          <Heading title="Server Information" description="Hardware and system details for this server" />
        </HeaderContainer>

        <div className="space-y-4">
          {/* System */}
          <SectionCard title="System Information">
            <InfoRow label="Hostname" value={info.system.hostname} />
            <InfoRow label="OS" value={info.system.os} />
            <InfoRow label="Architecture" value={info.system.arch} />
            <InfoRow label="Uptime" value={info.system.uptime} />
            <InfoRow label="Kernel" value={info.system.kernel} />
          </SectionCard>

          {/* Memory */}
          <SectionCard title="Memory Information">
            <div className="mb-4 space-y-3">
              <UsageBar percent={info.memory.usage_percent} label="RAM Usage" />
              {info.memory.swap_total !== '0 B' && (
                <UsageBar percent={info.memory.swap_usage_percent} label="Swap Usage" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-8 md:grid-cols-3">
              {[
                ['Total', info.memory.total],
                ['Used', info.memory.used],
                ['Free', info.memory.free],
                ['Available', info.memory.available],
                ['Shared', info.memory.shared],
                ['Buff/Cache', info.memory.buff_cache],
              ].map(([label, value]) => (
                <InfoRow key={label} label={label} value={value} />
              ))}
            </div>
            {info.memory.swap_total !== '0 B' && (
              <div className="mt-2 grid grid-cols-3 gap-x-8">
                {[
                  ['Swap Total', info.memory.swap_total],
                  ['Swap Used', info.memory.swap_used],
                  ['Swap Free', info.memory.swap_free],
                ].map(([label, value]) => (
                  <InfoRow key={label} label={label} value={value} />
                ))}
              </div>
            )}
          </SectionCard>

          {/* CPU */}
          <SectionCard title={`Processor Information (${info.total_processors} cores)`}>
            <div className="space-y-4">
              {info.processors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No processor data available.</p>
              ) : (
                info.processors.map((p) => (
                  <div key={p.index} className="rounded-md border p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Core #{p.index}</p>
                    <InfoRow label="Vendor" value={p.vendor} />
                    <InfoRow label="Model" value={p.name} />
                    <InfoRow label="Speed" value={p.speed} />
                    <InfoRow label="Cache" value={p.cache} />
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Disks */}
          {info.disks.length > 0 && (
            <SectionCard title="Disk Usage">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {['Filesystem', 'Size', 'Used', 'Avail', 'Use%', 'Mounted on'].map((h) => (
                        <th key={h} className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {info.disks.map((d, i) => {
                      const pct = parseInt(d.use_percent);
                      const rowColor = pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-yellow-500' : '';
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{d.filesystem}</td>
                          <td className="py-2 pr-4">{d.size}</td>
                          <td className={`py-2 pr-4 font-medium ${rowColor}`}>{d.used}</td>
                          <td className="py-2 pr-4">{d.avail}</td>
                          <td className={`py-2 pr-4 font-medium ${rowColor}`}>{d.use_percent}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{d.mounted_on}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Raw console output */}
          <div className="rounded-md border shadow-xs">
            <button
              type="button"
              className="flex w-full items-center justify-between bg-muted/40 border-b px-4 py-2.5 text-left"
              onClick={() => setShowRaw((v) => !v)}
            >
              <h3 className="text-sm font-semibold">Raw Console Output</h3>
              {showRaw ? <ChevronUpIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}
            </button>
            {showRaw && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-7 text-xs"
                  onClick={copyRaw}
                >
                  <ClipboardIcon className="size-3.5" />
                  Copy
                </Button>
                <pre className="max-h-96 overflow-auto bg-muted/20 p-4 pt-10 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {info.raw_report}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Container>
    </ServerLayout>
  );
}
