import { useTranslate } from '@/hooks/use-translate';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WifiOffIcon } from 'lucide-react';
import { Server } from '@/types/server';
import { Button } from '@/components/ui/button';
import { Link } from '@inertiajs/react';
import { useDialog } from '@/hooks/use-dialog';
import { withQuery } from '@/lib/url';

export default function ServerOfflineBanner({ server }: { server: Server }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  return (
    <Alert className="border-warning/35 bg-warning/5 [&>svg]:text-warning">
      <WifiOffIcon />
      <AlertTitle>{translateText("Server offline — read-only mode")}</AlertTitle>
      <AlertDescription>
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 basis-64">{translateText("Saved data is available. Changes and live metrics are paused until the server reconnects.")}</p>
          {server.can_power_manage ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            dialog.confirm.open({
              title: translateText("Start :value?", { value: server.name }),
              description: translateText("Power on this server via :value? The server will boot up and reconnect.", { value: server.provider }),
              confirmLabel: 'Start server',
              method: 'post',
              url: `/servers/${server.id}/start`,
            })
          }
        >
          {translateText("Start server")}
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link href={withQuery(`/servers/${server.id}/restart`, { start: 1 })}>
            {translateText('Restart')}
          </Link>
        </Button>
      )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
