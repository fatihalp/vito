import { useTranslate } from '@/hooks/use-translate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CheckIcon, GaugeIcon, LoaderCircleIcon, MapPinIcon } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { fetchHetznerLatencies, getCachedLatencies, getHetznerRegion, hetznerRegions, type Latencies } from './hetzner-regions';

export default function HetznerRegionSelect({
  value,
  onChange,
  loading = false,
}: {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}) {
  const translateText = useTranslate();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [latencies, setLatencies] = useState<Latencies>(() => getCachedLatencies() || {});

  const selectedRegion = getHetznerRegion(value);
  const bestRegion = useMemo(() => {
    const measured = Object.entries(latencies).filter((entry): entry is [string, number] => typeof entry[1] === 'number');

    return measured.sort((a, b) => a[1] - b[1])[0]?.[0];
  }, [latencies]);

  const measureAll = async (force = true) => {
    setTesting(true);
    if (force) {
      setLatencies(Object.fromEntries(hetznerRegions.map((region) => [region.value, null])));
    }

    try {
      const data = await fetchHetznerLatencies(force);
      setLatencies(data);
    } catch {
      void 0;
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (open) {
      const cached = getCachedLatencies();
      if (cached && Object.keys(cached).length > 0) {
        setLatencies(cached);
      } else {
        measureAll(false);
      }
    }
  }, [open]);

  const latencyText = (value: string) => {
    if (!(value in latencies)) return testing ? '...' : '-';
    if (latencies[value] === null) {
      return testing ? '...' : 'timeout';
    }

    return `${latencies[value]} ms`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-auto min-h-10 justify-between gap-3 px-3 py-2 text-left font-normal" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              {translateText("Detecting nearest region...")}
            </span>
          ) : selectedRegion ? (
            <span className="grid min-w-0 gap-1">
              <span className="truncate font-medium">
                {selectedRegion.code} - {selectedRegion.city}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {selectedRegion.country}, {selectedRegion.zone}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{translateText("Select Hetzner region")}</span>
          )}
          {loading ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin opacity-50" /> : <MapPinIcon className="size-4 shrink-0" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{translateText("Hetzner Region")}</DialogTitle>
          <DialogDescription>{translateText("Latency is measured from this Pure server with small HTTP requests to Hetzner speedtest endpoints.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-muted-foreground text-sm">{translateText("Only Hetzner Cloud locations are listed.")}</div>
            <Button type="button" variant="outline" onClick={() => measureAll(true)} disabled={testing}>
              {testing ? <LoaderCircleIcon className="animate-spin" /> : <GaugeIcon />}
              {translateText("Test latency")}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translateText('Region')}</TableHead>
                <TableHead>{translateText("Location")}</TableHead>
                <TableHead>{translateText("Network Zone")}</TableHead>
                <TableHead>{translateText("Latency")}</TableHead>
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
                        {best && <Badge variant="success">{translateText("Best")}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {selected && (
                        <Badge variant="success">
                          <CheckIcon className="size-3" />
                          {translateText("Selected")}
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
            {translateText('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
