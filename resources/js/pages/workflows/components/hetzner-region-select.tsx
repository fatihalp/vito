import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CheckIcon, GaugeIcon, LoaderCircleIcon, MapPinIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getHetznerRegion, hetznerRegions } from '../hetzner-regions';

type Latencies = Record<string, number | null>;

export default function HetznerRegionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [latencies, setLatencies] = useState<Latencies>({});
  const selectedRegion = getHetznerRegion(value);
  const bestRegion = useMemo(() => {
    const measured = Object.entries(latencies).filter((entry): entry is [string, number] => typeof entry[1] === 'number');

    return measured.sort((a, b) => a[1] - b[1])[0]?.[0];
  }, [latencies]);

  const measureRegion = async (url: string) => {
    const samples: number[] = [];

    for (let index = 0; index < 3; index += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      const startedAt = performance.now();

      try {
        await fetch(`${url}?v=${Date.now()}-${index}`, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        samples.push(performance.now() - startedAt);
      } catch {
        if (samples.length === 0) return null;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    return Math.round(Math.min(...samples));
  };

  const measureAll = async () => {
    setTesting(true);
    setLatencies(Object.fromEntries(hetznerRegions.map((region) => [region.value, null])));

    const results = await Promise.all(
      hetznerRegions.map(async (region) => ({
        value: region.value,
        latency: await measureRegion(region.speedTestUrl),
      })),
    );

    setLatencies(Object.fromEntries(results.map((result) => [result.value, result.latency])));
    setTesting(false);
  };

  const latencyText = (value: string) => {
    if (!(value in latencies)) return '-';
    if (latencies[value] === null) return 'timeout';

    return `${latencies[value]} ms`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left font-normal">
          {selectedRegion ? (
            <span className="grid min-w-0 gap-1">
              <span className="truncate font-medium">
                {selectedRegion.code} - {selectedRegion.city}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {selectedRegion.country}, {selectedRegion.zone}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select Hetzner region</span>
          )}
          <MapPinIcon className="size-4 shrink-0" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Hetzner Region</DialogTitle>
          <DialogDescription>Latency is measured from this browser with small HTTP requests to Hetzner speedtest endpoints.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-muted-foreground text-sm">Only Hetzner Cloud locations are listed.</div>
            <Button type="button" variant="outline" onClick={measureAll} disabled={testing}>
              {testing ? <LoaderCircleIcon className="animate-spin" /> : <GaugeIcon />}
              Test latency
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Network Zone</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hetznerRegions.map((region) => {
                const selected = region.value === value;
                const best = region.value === bestRegion;

                return (
                  <TableRow
                    key={region.value}
                    className={cn('cursor-pointer', selected && 'bg-primary/5')}
                    onClick={() => {
                      onChange(region.value);
                      setOpen(false);
                    }}
                  >
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="font-medium">{region.code}</span>
                        <span className="text-muted-foreground text-xs">{region.value}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {region.city}, {region.country}
                    </TableCell>
                    <TableCell>{region.zone}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{latencyText(region.value)}</span>
                        {best && <Badge variant="success">Best</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {selected && (
                        <Badge variant="success">
                          <CheckIcon className="size-3" />
                          Selected
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
