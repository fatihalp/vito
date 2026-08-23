import { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { ChevronDownIcon, ChevronUpIcon, ClipboardIcon, CpuIcon, HardDriveIcon, ServerIcon } from 'lucide-react';
import { Server } from '@/types/server';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

function CompactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground font-medium truncate max-w-[240px]" title={value}>
        {value || '-'}
      </span>
    </div>
  );
}

function UsageBar({ percent, label, used, total }: { percent: number; label: string; used?: string; total?: string }) {
  const isHigh = percent >= 85;
  const isMed = percent >= 70;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs">
          {used && total ? `${used} / ${total} ` : ''}
          <span className={cn('font-semibold', isHigh ? 'text-destructive' : isMed ? 'text-amber-500' : 'text-foreground')}>
            ({percent}%)
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isHigh ? 'bg-destructive' : isMed ? 'bg-amber-500' : 'bg-primary/80'
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function Information() {
  const { server, info } = usePage<Page>().props;
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyRaw = () => {
    navigator.clipboard.writeText(info.raw_report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  if (info.error) {
    return (
      <ServerLayout>
        <Head title={`Server Information - ${server.name}`} />
        <Container className="max-w-5xl">
          <HeaderContainer>
            <Heading title="Server Information" description="Hardware and system details for this server" />
          </HeaderContainer>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            {info.error}
          </div>
        </Container>
      </ServerLayout>
    );
  }

  const firstProc = info.processors[0];

  return (
    <ServerLayout>
      <Head title={`Server Information - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Server Information" description="Hardware and system details for this server" />
        </HeaderContainer>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: System & CPU */}
          <div className="space-y-4">
            {/* System */}
            <div className="rounded-md border shadow-2xs overflow-hidden">
              <div className="bg-muted/30 flex items-center gap-2 border-b px-3.5 py-2">
                <ServerIcon className="size-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold">System</h3>
              </div>
              <div className="p-3.5 space-y-0.5">
                <CompactRow label="Hostname" value={info.system.hostname} />
                <CompactRow label="OS" value={info.system.os} />
                <CompactRow label="Architecture" value={info.system.arch} />
                <CompactRow label="Uptime" value={info.system.uptime} />
                <CompactRow label="Kernel" value={info.system.kernel} />
              </div>
            </div>

            {/* Processor */}
            <div className="rounded-md border shadow-2xs overflow-hidden">
              <div className="bg-muted/30 flex items-center justify-between border-b px-3.5 py-2">
                <div className="flex items-center gap-2">
                  <CpuIcon className="size-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold">Processor</h3>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {info.total_processors} core{info.total_processors !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-3.5 space-y-0.5">
                {firstProc ? (
                  <>
                    <CompactRow label="Model" value={firstProc.name} />
                    <CompactRow label="Vendor" value={firstProc.vendor} />
                    <CompactRow label="Speed" value={firstProc.speed} />
                    <CompactRow label="Cache" value={firstProc.cache} />
                    <CompactRow label="Cores" value={`${info.total_processors} active`} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No CPU data available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Memory & Disks */}
          <div className="space-y-4">
            {/* Memory */}
            <div className="rounded-md border shadow-2xs overflow-hidden">
              <div className="bg-muted/30 flex items-center justify-between border-b px-3.5 py-2">
                <h3 className="text-xs font-semibold">Memory</h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Total: {info.memory.total}
                </span>
              </div>
              <div className="p-3.5 space-y-3">
                <UsageBar
                  percent={info.memory.usage_percent}
                  label="RAM"
                  used={info.memory.used}
                  total={info.memory.total}
                />
                {info.memory.swap_total && info.memory.swap_total !== '0 B' && (
                  <UsageBar
                    percent={info.memory.swap_usage_percent}
                    label="Swap"
                    used={info.memory.swap_used}
                    total={info.memory.swap_total}
                  />
                )}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Free</span>
                    <span className="font-mono font-medium">{info.memory.free}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Available</span>
                    <span className="font-mono font-medium">{info.memory.available}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Buff/Cache</span>
                    <span className="font-mono font-medium">{info.memory.buff_cache}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Disks */}
            {info.disks.length > 0 && (
              <div className="rounded-md border shadow-2xs overflow-hidden">
                <div className="bg-muted/30 flex items-center gap-2 border-b px-3.5 py-2">
                  <HardDriveIcon className="size-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold">Storage &amp; Disks</h3>
                </div>
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/10 text-muted-foreground">
                        <th className="py-1.5 px-3 text-left font-medium">Mount</th>
                        <th className="py-1.5 px-3 text-left font-medium">Size</th>
                        <th className="py-1.5 px-3 text-left font-medium">Used</th>
                        <th className="py-1.5 px-3 text-left font-medium">Avail</th>
                        <th className="py-1.5 px-3 text-right font-medium">Use%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {info.disks.map((d, i) => {
                        const pct = parseInt(d.use_percent);
                        return (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="py-1.5 px-3 font-mono text-[11px] truncate max-w-[120px]" title={d.mounted_on}>
                              {d.mounted_on}
                            </td>
                            <td className="py-1.5 px-3 font-mono text-muted-foreground">{d.size}</td>
                            <td className="py-1.5 px-3 font-mono">{d.used}</td>
                            <td className="py-1.5 px-3 font-mono text-muted-foreground">{d.avail}</td>
                            <td className="py-1.5 px-3 font-mono text-right">
                              <span className={cn('font-medium', pct >= 85 ? 'text-destructive' : pct >= 70 ? 'text-amber-500' : 'text-foreground')}>
                                {d.use_percent}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Raw Report */}
        <div className="rounded-md border shadow-2xs overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between bg-muted/30 px-3.5 py-2 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setShowRaw((v) => !v)}
          >
            <span className="text-xs font-semibold text-muted-foreground">Raw Console Output</span>
            {showRaw ? <ChevronUpIcon className="size-3.5 text-muted-foreground" /> : <ChevronDownIcon className="size-3.5 text-muted-foreground" />}
          </button>
          {showRaw && (
            <div className="relative border-t">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 h-6 px-2 text-[11px]"
                onClick={copyRaw}
              >
                <ClipboardIcon className="size-3 mr-1" />
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <pre className="max-h-72 overflow-auto bg-muted/10 p-3 pt-8 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/80">
                {info.raw_report}
              </pre>
            </div>
          )}
        </div>
      </Container>
    </ServerLayout>
  );
}
