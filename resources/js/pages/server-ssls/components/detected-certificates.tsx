import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DateTime from '@/components/date-time';

type Certificate = { fingerprint: string; domains: string[]; expires_at: string; days_remaining: number; status: 'expired' | 'expiring' | 'valid' | 'not-yet-valid'; registered: boolean };
type Inventory = { checked_at: string; certificates: Certificate[]; discovered: number; unreadable: number; complete: boolean };

export default function DetectedCertificates({ serverId }: { serverId: number }) {
  const translateText = useTranslate();
  const inventory = useQuery({ queryKey: ['detected-certificates', serverId], queryFn: async () => (await axios.get<Inventory>(`/servers/${serverId}/ssl/observed`)).data, staleTime: 600_000, retry: false });

  return <section className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">{translateText('Detected server certificates')}</h3><Button variant="outline" size="sm" disabled={inventory.isFetching} onClick={() => void inventory.refetch()}>{translateText('Refresh')}</Button></div>
    <p className="text-muted-foreground text-sm">{translateText('Read-only certificate expiry from the current Nginx configuration. Existing renewal services stay responsible; this view does not install or renew certificates. Results are cached for ten minutes.')}</p>
    {inventory.isPending && <p role="status">{translateText('Inspecting existing certificates...')}</p>}
    {inventory.isError && <p role="alert">{translateText('Certificate inspection failed. Check SSH access and Nginx or Mailcow configuration, then retry.')}</p>}
    {inventory.data && <>
      <p className="text-muted-foreground text-xs">{translateText('Last status check')}: <DateTime date={inventory.data.checked_at} /></p>
      {!inventory.data.complete && <p role="alert">{translateText('Certificate discovery is incomplete. Some configured certificates could not be inspected; do not treat this list as complete.')}</p>}
      {inventory.data.complete && !inventory.data.certificates.length && <p>{translateText('No certificates were detected in the current configuration.')}</p>}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">{inventory.data.certificates.map((certificate) => <Card key={certificate.fingerprint}>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2"><CardTitle className="min-w-0 break-all text-sm">{certificate.domains.join(', ') || translateText('Certificate')}</CardTitle><Badge variant={certificate.status === 'valid' ? 'success' : certificate.status === 'expiring' ? 'warning' : 'danger'}>{translateText(certificate.status)}</Badge></CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 text-sm"><p>{translateText('Expires')}: <DateTime date={certificate.expires_at} /></p><p>{translateText('Days remaining')}: {certificate.days_remaining}</p><p className="text-muted-foreground">{translateText(certificate.registered ? 'Registered in Vito' : 'Managed outside Vito')}</p><p className="break-all font-mono text-xs">SHA256: {certificate.fingerprint}</p></CardContent>
      </Card>)}</div>
    </>}
  </section>;
}
