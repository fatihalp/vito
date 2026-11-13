import { useTranslate } from '@/hooks/use-translate';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';

export default function ServerConfigDialog({
  open,
  onOpenChange,
  networkId,
  memberId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  networkId: number;
  memberId: number;
  name: string;
}) {
  const translateText = useTranslate();
  const [data, setData] = useState<{ config: string; status: string | null } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setData(null);
    setError('');
    axios
      .get(`/networks/${networkId}/servers/${memberId}/config`, { signal: controller.signal })
      .then((response) => setData(response.data))
      .catch((e) => {
        if (!axios.isCancel(e)) setError('Could not load the WireGuard configuration.');
      });

    return () => controller.abort();
  }, [open, networkId, memberId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translateText("WireGuard on")} {name}</DialogTitle>
          <DialogDescription>{translateText("The live connection status and the configuration Pure wrote. The private key never leaves the server.")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-6 overflow-y-auto p-4">
          {!data && !error && (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <LoaderCircleIcon className="size-4 animate-spin" />
              {translateText("Loading…")}
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          )}

          {data && (
            <>
              <section className="space-y-2">
                <p className="text-sm font-medium">{translateText("Live status (wg show)")}</p>
                {data.status !== null ? (
                  <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">{data.status || translateText("The interface is not up.")}</pre>
                ) : (
                  <p className="text-muted-foreground text-sm">{translateText("Pure could not reach the server to read the live status.")}</p>
                )}
              </section>
              <section className="space-y-2">
                <p className="text-sm font-medium">{translateText('Configuration')}</p>
                <pre className="bg-muted/50 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">{data.config}</pre>
              </section>
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{translateText('Close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
