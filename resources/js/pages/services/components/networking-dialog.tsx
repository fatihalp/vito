import { useTranslate } from '@/hooks/use-translate';
import { type ReactNode, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircleIcon, CopyIcon, LoaderCircleIcon, RefreshCwIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Skeleton } from '@/components/ui/skeleton';
import DateTime from '@/components/date-time';
import { SOCKET_EVENT } from '@/stores/socket-store';
import { Service } from '@/types/service';

type NetworkingUnsupported = {
  supported: false;
};

type NetworkingSupported = {
  supported: true;
  pending: boolean;
  failed: boolean;
  enabled: boolean;
  managed: boolean;
  port: number;
  effective: boolean | null;
  checked_at: string | null;
  secret?: string | null;
  uses_password?: boolean;
  requires_remote_users?: boolean;
};

type NetworkingResponse = NetworkingUnsupported | NetworkingSupported;

const networkingQueryKey = (service: Service) => ['services.networking', service.server_id, service.id];

function StateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-sm">{label}</span>
      {children}
    </div>
  );
}

function SecretField({
  secret,
  busy,
  onRegenerate,
  onRemove,
}: {
  secret: string;
  busy: boolean;
  onRegenerate: () => void;
  onRemove: (() => void) | null;
}) {
  const translateText = useTranslate();
  const copy = () => {
    if (!navigator.clipboard) {
      toast.error('The clipboard is not available in this browser');
      return;
    }

    navigator.clipboard
      .writeText(secret)
      .then(() => toast.success('Password copied to clipboard'))
      .catch(() => toast.error('Failed to copy the password'));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="networking-secret">{translateText('Password')}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <PasswordInput id="networking-secret" readOnly value={secret} className="font-mono" />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={translateText("Copy password")}>
          <CopyIcon />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRegenerate}>
          <RefreshCwIcon />
          {translateText('Regenerate')}
        </Button>
        {onRemove && (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRemove}>
            <Trash2Icon />
            {translateText('Remove')}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        {onRemove
          ? translateText("Both restart the service. Every client must be updated to the new password, or to no password at all.")
          : translateText("Regenerating restarts the service - every client must be updated to the new password. The password can only be removed while the service is local only.")}
      </p>
    </div>
  );
}

export default function ServiceNetworkingDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}) {
  const translateText = useTranslate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const query = useQuery<NetworkingResponse>({
    queryKey: networkingQueryKey(service),
    queryFn: async () => {
      const response = await axios.get(`/servers/${service.server_id}/services/${service.id}/networking`);
      return response.data;
    },
    retry: false,
    enabled: open,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (currentQuery) => {
      const data = currentQuery.state.data;
      return data?.supported && data.pending ? 3000 : false;
    },
  });

  const data = query.data;
  const details: NetworkingSupported | null = data && data.supported ? data : null;
  const pending = details?.pending ?? false;
  const usesPassword = details?.uses_password === true;
  const networked = details === null ? false : (details.effective ?? details.enabled);
  const unknown = details !== null && !pending && details.effective === null;
  const neverChecked = unknown && details.checked_at === null;

  useEffect(() => {
    const handler = (event: CustomEvent<{ type: string; data: Record<string, unknown> }>) => {
      const { type, data: payload } = event.detail;
      const matchesService = type === 'service.updated' && payload?.id === service.id;
      const matchesServer = type === 'service.refreshed' && payload?.server_id === service.server_id;

      if (matchesService || matchesServer) {
        void queryClient.invalidateQueries({ queryKey: networkingQueryKey(service) });
      }
    };

    window.addEventListener(SOCKET_EVENT, handler);

    return () => window.removeEventListener(SOCKET_EVENT, handler);
  }, [queryClient, service]);

  const params = { server: service.server_id, service: service.id };

  const submit = async (request: () => Promise<unknown>) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await request();
      await queryClient.invalidateQueries({ queryKey: networkingQueryKey(service) });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
        const messages = payload?.errors ? Object.values(payload.errors).flat() : [];
        setSubmitError(messages.length > 0 ? messages.join(' ') : (payload?.message ?? 'Failed to update networking.'));
      } else {
        setSubmitError('Failed to update networking.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = (action: 'enable' | 'disable') => submit(() => axios.post(`/servers/${params.server}/services/${params.service}/networking/${action}`));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {translateText("Networking for")} <span className="capitalize">{service.name}</span>
          </DialogTitle>
          <DialogDescription>
            {translateText("Networking opens this service on all IPv4 interfaces (0.0.0.0) so other servers can reach it. Access is only gated by authentication and your firewall.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 p-4">
          {query.isLoading && (
            <>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {query.isError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>{translateText("Could not load networking state")}</AlertTitle>
              <AlertDescription>
                {(axios.isAxiosError(query.error) ? query.error.response?.data?.message : null) ?? translateText("Please try again in a moment.")}
              </AlertDescription>
            </Alert>
          )}

          {data && !data.supported && (
            <Alert>
              <AlertCircleIcon />
              <AlertTitle>{translateText("Not supported")}</AlertTitle>
              <AlertDescription>{translateText("This service does not support the networking toggle.")}</AlertDescription>
            </Alert>
          )}

          {details && (
            <>
              <div className="flex flex-col gap-2">
                <StateRow label={translateText('Networking')}>
                  {pending ? (
                    <Badge variant="gray">{translateText("Applying…")}</Badge>
                  ) : unknown ? (
                    <Badge variant="gray">{translateText("Unknown")}</Badge>
                  ) : (
                    <Badge variant={networked ? 'success' : 'gray'}>{networked ? translateText("Listening on all interfaces") : translateText("Local only")}</Badge>
                  )}
                </StateRow>
                <StateRow label={translateText("Default port")}>
                  <span className="font-mono text-sm">{details.port}</span>
                </StateRow>
              </div>

              {pending && (
                <Alert>
                  <LoaderCircleIcon className="animate-spin" />
                  <AlertTitle>{translateText("Applying the change")}</AlertTitle>
                  <AlertDescription>
                    {translateText("Pure is updating the configuration and restarting the service. This dialog updates automatically.")}
                  </AlertDescription>
                </Alert>
              )}

              {details.failed && !pending && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>{translateText("The last change failed")}</AlertTitle>
                  <AlertDescription>
                    {translateText("Pure could not apply the last networking change and reverted the configuration. Check the server logs for details, then try again.")}
                  </AlertDescription>
                </Alert>
              )}

              {unknown && (
                <Alert>
                  <TriangleAlertIcon />
                  <AlertTitle>{translateText("Refresh the services first")}</AlertTitle>
                  <AlertDescription>
                    <p>
                      {neverChecked ? (
                        <>{translateText("Pure hasn't checked this service's live state yet.")}</>
                      ) : (
                        <>
                          {translateText("Pure couldn't read this service's live state on the last check (")}<DateTime date={details.checked_at as string} />
                          {translateText("). Check that the service is healthy first.")}
                        </>
                      )}{' '}
                      {translateText("Close this dialog and use Refresh on the Services page - networking can't be changed until Pure knows the current state.")}
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {usesPassword && !pending && !networked && !details.secret && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>{translateText("A password will be set")}</AlertTitle>
                  <AlertDescription>
                    {translateText("Pure generates a password when networking is enabled. Every existing client on this server (apps, workers, queues) must be updated to authenticate with it, or it will fail with NOAUTH.")}
                  </AlertDescription>
                </Alert>
              )}

              {usesPassword && !pending && !details.failed && !networked && details.secret && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertTitle>{translateText("A password has been generated")}</AlertTitle>
                  <AlertDescription>
                    {translateText("Networking is off. If it was ever enabled, this password is still in effect on the server and every client must keep authenticating with it. Enabling networking applies it again.")}
                  </AlertDescription>
                </Alert>
              )}

              {usesPassword && !pending && networked && (
                <Alert>
                  <AlertCircleIcon />
                  <AlertTitle>{translateText("Disabling keeps the password")}</AlertTitle>
                  <AlertDescription>
                    {translateText("The service goes back to local only, but the password remains set - local clients keep authenticating with it.")}
                  </AlertDescription>
                </Alert>
              )}

              {usesPassword && details.secret && (
                <SecretField
                  secret={details.secret}
                  busy={submitting || pending}
                  onRegenerate={() => void submit(() => axios.post(`/servers/${encodeURIComponent(String(params.server))}/services/${encodeURIComponent(String(params.service))}/networking/secret`))}
                  onRemove={networked ? null : () => void submit(() => axios.delete(`/servers/${encodeURIComponent(String(params.server))}/services/${encodeURIComponent(String(params.service))}/networking/secret`))}
                />
              )}

              {details.requires_remote_users === true && (
                <Alert>
                  <AlertCircleIcon />
                  <AlertTitle>{translateText("Remote database users are required")}</AlertTitle>
                  <AlertDescription>{translateText("Remote servers need a database user with remote host (%) to connect.")}</AlertDescription>
                </Alert>
              )}

              {details.requires_remote_users === false && (
                <Alert>
                  <AlertCircleIcon />
                  <AlertTitle>{translateText("Authentication")}</AlertTitle>
                  <AlertDescription>{translateText("Remote connections authenticate with database user passwords.")}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {submitError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{translateText('Close')}</Button>
          </DialogClose>
          {details && (
            <Button
              variant={networked ? 'destructive' : 'default'}
              disabled={submitting || pending || unknown}
              onClick={() => toggle(networked ? 'disable' : 'enable')}
            >
              {(submitting || pending) && <LoaderCircleIcon className="animate-spin" />}
              {networked ? translateText("Close Remote Access (Disable)") : translateText("Open to Remote (Enable)")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
