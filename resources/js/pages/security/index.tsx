import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ReactNode, useCallback, useState } from 'react';
import { Server } from '@/types/server';
import { Service } from '@/types/service';
import { AutoUpdateState, PasswordAuthState, RootLoginState, SecurityScore } from '@/types/security';
import ServerLayout from '@/layouts/server/layout';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import Container from '@/components/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import InputError from '@/components/ui/input-error';
import { useDialog } from '@/hooks/use-dialog';
import { useSocketListener } from '@/hooks/use-socket-events';
import { InfoIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ScheduleBuilder, { buildSchedule, parseSchedule } from '@/pages/security/components/schedule-builder';
import SecurityToggleCard from '@/pages/security/components/security-toggle-card';

function serviceStatusLabel(status: string): string {
  return status === 'ready' ? 'applied' : status;
}

function AutoUpdateRow({ server, autoUpdate }: { server: number; autoUpdate: AutoUpdateState }) {
  const [parsed, setParsed] = useState(parseSchedule(autoUpdate.schedule));
  const form = useForm<{ enabled: boolean; schedule: string }>({
    enabled: autoUpdate.enabled,
    schedule: autoUpdate.schedule ?? buildSchedule(parseSchedule(null)),
  });

  const save = () => form.post(`/servers/${server}/security/auto-update`, { preserveScroll: true });

  return (
    <div>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Automatic updates
              <Badge variant={autoUpdate.enabled ? 'success' : 'gray'}>{autoUpdate.enabled ? 'applied' : 'not applied'}</Badge>
            </CardTitle>
            <CardDescription>Vito applies package updates to this server on a schedule (times are UTC).</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Switch checked={form.data.enabled} onCheckedChange={(value) => form.setData('enabled', value)} aria-label="Enable automatic updates" />
            <Button onClick={save} disabled={form.processing}>
              {form.processing && <LoaderCircleIcon className="animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      {form.data.enabled && (
        <CardContent className="flex flex-col gap-3 px-4 pb-4">
          <ScheduleBuilder
            value={parsed}
            onChange={(next) => {
              setParsed(next);
              form.setData('schedule', buildSchedule(next));
            }}
          />
          <InputError message={form.errors.schedule} />
          <p className="text-muted-foreground text-xs">
            Disabling automatic updates stops future runs only; it does not undo updates already applied.
          </p>
        </CardContent>
      )}
    </div>
  );
}

function Fail2banRow({ server, fail2ban }: { server: number; fail2ban: Service | null }) {
  const dialog = useDialog();
  const installing = fail2ban?.status === 'installing' || fail2ban?.status === 'uninstalling';

  return (
    <div>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Fail2ban
              {fail2ban ? (
                <Badge variant={fail2ban.status_color} aria-busy={installing}>
                  {installing && <LoaderCircleIcon className="animate-spin" />}
                  {serviceStatusLabel(fail2ban.status)}
                </Badge>
              ) : (
                <Badge variant="gray">not applied</Badge>
              )}
            </CardTitle>
            <CardDescription>Bans IP addresses with too many failed SSH login attempts.</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {fail2ban ? (
              <>
                <Button variant="outline" disabled={installing} onClick={() => dialog.fail2banForm.open({ serverId: server, fail2ban })}>
                  Configure
                </Button>
                <Button
                  variant="destructive"
                  disabled={installing}
                  onClick={() =>
                    dialog.confirm.open({
                      title: 'Uninstall Fail2ban',
                      description: 'This removes Fail2ban and its configuration from the server, and from the Services list.',
                      variant: 'destructive',
                      confirmLabel: 'Uninstall',
                      method: 'delete',
                      url: `/servers/${server}/security/fail2ban`,
                    })
                  }
                >
                  Uninstall
                </Button>
              </>
            ) : (
              <Button onClick={() => dialog.fail2banForm.open({ serverId: server, fail2ban: null })}>Install</Button>
            )}
          </div>
        </div>
      </CardHeader>
      {fail2ban && (
        <CardContent className="px-4 pb-4">
          <p className="text-muted-foreground text-xs">View banned IPs and activity in Service logs.</p>
        </CardContent>
      )}
    </div>
  );
}

function ScoreCard({ score, children }: { score: SecurityScore; children: ReactNode }) {
  const textColor = score.score >= 80 ? 'text-success' : score.score >= 40 ? 'text-warning' : 'text-destructive';
  const barColor =
    score.score >= 80
      ? '[&>[data-slot=progress-indicator]]:bg-success'
      : score.score >= 40
        ? '[&>[data-slot=progress-indicator]]:bg-warning'
        : '[&>[data-slot=progress-indicator]]:bg-destructive';

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-1.5">
            Security score
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="About the security score">
                  <InfoIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                This score only reflects the hardening features Vito manages. It is not an indicative or complete security rating for your server.
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-semibold ${textColor}`}>{score.score}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
        </div>
        <Progress value={score.score} className={cn('bg-primary/10 dark:bg-primary/20', barColor)} />
      </CardContent>
      <div className="divide-y border-t [&_[data-slot=card-header]]:border-b-0">{children}</div>
    </Card>
  );
}

function FirewallRow({ server, firewall }: { server: number; firewall: Service | null }) {
  const installing = firewall?.status === 'installing' || firewall?.status === 'uninstalling';
  return (
    <div>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              Firewall
              {firewall ? (
                <Badge variant={firewall.status_color} aria-busy={installing}>
                  {installing && <LoaderCircleIcon className="animate-spin" />}
                  {serviceStatusLabel(firewall.status)}
                </Badge>
              ) : (
                <Badge variant="gray">not applied</Badge>
              )}
            </CardTitle>
            <CardDescription>A UFW firewall controls which ports accept inbound connections.</CardDescription>
          </div>
          {firewall ? (
            <Button variant="outline" asChild>
              <Link href={`/servers/${server}/firewall`}>Manage rules</Link>
            </Button>
          ) : (
            <Button disabled={installing} onClick={() => router.post(`/servers/${server}/security/firewall`, {}, { preserveScroll: true })}>
              Install
            </Button>
          )}
        </div>
      </CardHeader>
    </div>
  );
}

export default function Security() {
  const page = usePage<{
    server: Server;
    score: SecurityScore;
    autoUpdate: AutoUpdateState;
    passwordAuth: PasswordAuthState;
    rootLogin: RootLoginState;
    fail2ban: Service | null;
    firewall: Service | null;
  }>();

  const serverId = page.props.server.id;
  const dialog = useDialog();
  const [checking, setChecking] = useState(false);

  useSocketListener(
    useCallback(
      (event) => {
        const data = event.data;
        const isObject = !!data && typeof data === 'object' && !Array.isArray(data);
        if (event.type === 'security.updated' && isObject && (data as { server_id?: number }).server_id === serverId) {
          router.reload({ only: ['passwordAuth', 'rootLogin', 'autoUpdate', 'fail2ban', 'firewall', 'score'] });
        } else if (event.type?.startsWith('service.') && isObject && (data as { server_id?: number }).server_id === serverId) {
          router.reload({ only: ['fail2ban', 'firewall', 'score'] });
        }
      },
      [serverId],
    ),
  );

  const check = () => {
    setChecking(true);
    router.post(`/servers/${serverId}/security/check`, {}, { preserveScroll: true, onFinish: () => setChecking(false) });
  };

  return (
    <ServerLayout>
      <Head title={`Security - ${page.props.server.name}`} />

      <Container>
        <HeaderContainer>
          <Heading title="Security" description="Harden this server: automatic updates, firewall, Fail2ban, and SSH access." />
          <Button variant="outline" onClick={check} disabled={checking} aria-label="Check security status">
            {checking ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
            <span className="hidden lg:block">Check status</span>
          </Button>
        </HeaderContainer>

        <div className="flex flex-col gap-4">
          <Alert>
            <TriangleAlertIcon className="text-warning" />
            <AlertDescription>
              Before applying changes, make sure you can access your provider's recovery console in case you need to restore SSH access.
            </AlertDescription>
          </Alert>

          <ScoreCard score={page.props.score}>
            <AutoUpdateRow
              key={`${page.props.autoUpdate.enabled}-${page.props.autoUpdate.schedule ?? ''}`}
              server={serverId}
              autoUpdate={page.props.autoUpdate}
            />
            <FirewallRow server={serverId} firewall={page.props.firewall} />
            <Fail2banRow server={serverId} fail2ban={page.props.fail2ban} />
            <SecurityToggleCard
              serverId={serverId}
              title="Disable password authentication"
              description="When on, SSH access requires a key and password logins are refused (global default only)."
              state={page.props.passwordAuth}
              onToggle={(nextSecure) => {
                dialog.confirm.open({
                  title: nextSecure ? 'Disable password authentication' : 'Allow password authentication',
                  description: nextSecure
                    ? 'Only SSH key authentication will be allowed. Make sure your key works — any password-only users will be locked out.'
                    : 'Password logins will be allowed again over SSH.',
                  variant: nextSecure ? 'destructive' : 'default',
                  confirmLabel: nextSecure ? 'Disable' : 'Allow',
                  method: 'post',
                  url: `/servers/${serverId}/security/password-auth`,
                  data: { enabled: !nextSecure },
                });
              }}
            />
            <SecurityToggleCard
              serverId={serverId}
              title="Disable root SSH login"
              description={page.props.rootLogin.manageable ? 'When on, the root user cannot log in over SSH.' : 'Vito currently connects to this server as root; switch to a non-root SSH user before disabling root login.'}
              state={page.props.rootLogin}
              onToggle={(nextSecure) => {
                dialog.confirm.open({
                  title: nextSecure ? 'Disable root SSH login' : 'Allow root SSH login',
                  description: nextSecure
                    ? 'Root SSH login will be refused. Vito connects as the deploy user and uses sudo, so this is safe.'
                    : 'Root will be allowed to log in over SSH again.',
                  variant: nextSecure ? 'destructive' : 'default',
                  confirmLabel: nextSecure ? 'Disable' : 'Allow',
                  method: 'post',
                  url: `/servers/${serverId}/security/root-login`,
                  data: { enabled: !nextSecure },
                });
              }}
            />
          </ScoreCard>
        </div>
      </Container>
    </ServerLayout>
  );
}
