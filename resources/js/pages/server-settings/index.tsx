import { useTranslate } from '@/hooks/use-translate';
import { withQuery } from '@/lib/url';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import {
  CheckIcon,
  CloudIcon,
  CopyIcon,
  DatabaseIcon,
  GlobeIcon,
  KeyRoundIcon,
  ListOrderedIcon,
  LoaderCircleIcon,
  NetworkIcon,
  RefreshCwIcon,
  ServerIcon,
  ShieldAlertIcon,
  SlidersIcon,
  TerminalIcon,
  ZapIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ServerStatus from '@/pages/servers/components/status';
import DateTime from '@/components/date-time';
import CopyableField from '@/components/copyable-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import DeleteServer from '@/pages/servers/components/delete-server';
import TransferServer from '@/pages/servers/components/transfer-server';
import ConnectSshDialog from '@/pages/servers/components/connect-ssh-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ServerRole } from '@/lib/server-roles';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import { FormEvent, useEffect } from 'react';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { useClipboard } from '@/hooks/use-clipboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const STAGE_OPTIONS = [
  {
    value: 'prod',
    label: 'Production',
    dotColor: 'bg-neutral-500',
    description: 'Live production environment',
  },
  {
    value: 'beta',
    label: 'Beta',
    dotColor: 'bg-neutral-500',
    description: 'Staging and testing environment',
  },
  {
    value: 'alfa',
    label: 'Alpha',
    dotColor: 'bg-neutral-500',
    description: 'Development and experimental environment',
  },
] as const;

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  app: GlobeIcon,
  database: DatabaseIcon,
  cache: ZapIcon,
  queue: ListOrderedIcon,
  custom: ServerIcon,
};

export default function ServerSettings() {
  const translateText = useTranslate();
  const configs = useConfigs()!;
  const page = usePage<{
    server: Server;
  }>();

  const server = useRealtimeRecord<Server>(page.props.server, 'server')!;
  const { copied: ipCopied, copy: copyIp } = useClipboard();
  const { copied: idCopied, copy: copyId } = useClipboard();

  const statusForm = useForm();
  const checkStatus = () => {
    if (['installing', 'installation_failed'].includes(server.status)) {
      return;
    }
    statusForm.patch(`/servers/${server.id}/status`);
  };

  const form = useForm<{
    name: string;
    ip: string;
    port: string;
    local_ip?: string;
    role: ServerRole;
    stage: 'prod' | 'beta' | 'alfa';
  }>({
    name: server.name,
    ip: server.ip,
    port: server.port.toString(),
    local_ip: server.local_ip,
    role: server.role_value,
    stage: server.stage || 'prod',
  });

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    form.patch(`/servers/${server.id}/settings/update`, {
      preserveScroll: true,
      onSuccess: () => {
        form.setDefaults();
      },
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (form.isDirty && !form.processing) {
          submit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form.isDirty, form.processing, form.data]);

  const sshUser = server.ssh_user || 'root';
  const portFlag = server.port && server.port !== 22 ? ` -p ${server.port}` : '';
  const sshCommand = `ssh ${sshUser}@${server.ip}${portFlag}`;

  return (
    <ServerLayout>
      <Head title={translateText("Settings - :value", { value: server.name })} />

      <Container>
        <HeaderContainer>
          <div className="flex flex-col gap-1">
            <Heading title={translateText('Settings')} description={translateText("Manage server configuration, network settings, and project assignment.")} />
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs cursor-pointer"
                    disabled={statusForm.processing || ['installing', 'installation_failed'].includes(server.status)}
                    onClick={checkStatus}
                  >
                    <RefreshCwIcon className={cn('size-3.5', statusForm.processing && 'animate-spin')} />
                    <span>{translateText("Check Connection")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {translateText("Probe SSH connection to verify server health")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </HeaderContainer>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <form onSubmit={submit}>
              <Card>
                <CardHeader className="p-6 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SlidersIcon className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{translateText('Configuration')}</CardTitle>
                      <CardDescription>{translateText("Update server details and network settings")}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5 p-6 pt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {translateText("Server Name")}
                    </Label>
                    <Input
                      id="name"
                      value={form.data.name}
                      onChange={(e) => form.setData('name', e.target.value)}
                      placeholder="e.g. production-app-1"
                    />
                    <InputError message={form.errors.name} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="stage" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {translateText("Environment Stage")}
                      </Label>
                      <Select
                        value={form.data.stage}
                        onValueChange={(value: 'prod' | 'beta' | 'alfa') => form.setData('stage', value)}
                      >
                        <SelectTrigger id="stage" className="w-full">
                          <SelectValue>
                            {(() => {
                              const selected = STAGE_OPTIONS.find((s) => s.value === form.data.stage);
                              return (
                                <div className="flex items-center gap-2">
                                  <span className={cn('size-2 rounded-full shrink-0', selected?.dotColor ?? 'bg-neutral-500')} />
                                  <span>{selected?.label ?? form.data.stage}</span>
                                </div>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STAGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <span className={cn('size-2 rounded-full shrink-0', option.dotColor)} />
                                <span className="font-medium">{option.label}</span>
                                <span className="text-muted-foreground text-xs font-normal">({option.description})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <InputError message={form.errors.stage} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {translateText("Server Role")}
                      </Label>
                      <Select
                        value={form.data.role}
                        onValueChange={(value: typeof form.data.role) => form.setData('role', value)}
                      >
                        <SelectTrigger id="role" className="w-full">
                          <SelectValue>
                            {(() => {
                              const selected = configs.server_roles.find((r) => r.value === form.data.role);
                              const Icon = ROLE_ICONS[form.data.role] ?? ServerIcon;
                              return (
                                <div className="flex items-center gap-2">
                                  <Icon className="size-4 text-muted-foreground shrink-0" />
                                  <span>{selected?.label ?? form.data.role}</span>
                                </div>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {configs.server_roles.map((option) => {
                            const Icon = ROLE_ICONS[option.value] ?? ServerIcon;
                            return (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="size-4 text-muted-foreground shrink-0" />
                                  <span>{option.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <InputError message={form.errors.role} />
                    </div>
                  </div>

                  <Separator className="my-1" />

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <NetworkIcon className="size-3.5" />
                      <span>{translateText("Network & Connectivity")}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {translateText("Updating IP or Port will automatically test SSH connectivity.")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="ip">{translateText("Public IP Address")}</Label>
                      <div className="relative flex items-center">
                        <Input
                          id="ip"
                          value={form.data.ip}
                          onChange={(e) => form.setData('ip', e.target.value)}
                          placeholder="1.2.3.4"
                          className="pr-9 font-mono text-sm"
                        />
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => copyIp(form.data.ip)}
                              >
                                {ipCopied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {ipCopied ? translateText("Copied!") : translateText("Copy IP address")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <InputError message={form.errors.ip} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="port">{translateText("SSH Port")}</Label>
                      <Input
                        id="port"
                        value={form.data.port}
                        onChange={(e) => form.setData('port', e.target.value)}
                        placeholder="22"
                        className="font-mono text-sm"
                      />
                      <InputError message={form.errors.port} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="local_ip">{translateText("Private / Local IP")}</Label>
                      <span className="text-[11px] text-muted-foreground">{translateText('Optional')}</span>
                    </div>
                    <Input
                      id="local_ip"
                      value={form.data.local_ip ?? ''}
                      onChange={(e) => form.setData('local_ip', e.target.value)}
                      placeholder="e.g. 10.0.0.1"
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {translateText("Used for VPC or private internal routing between servers on the same cloud provider network.")}
                    </p>
                    <InputError message={form.errors.local_ip} />
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between border-t bg-muted/20 px-6 py-3.5">
                  <div>
                    {form.isDirty ? (
                      <span className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        <span className="size-2 rounded-full bg-neutral-500 animate-pulse" />
                        {translateText("Unsaved changes")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘S</kbd>
                        <span>{translateText("to save changes")}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {form.isDirty && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.reset()}
                      >
                        {translateText('Reset')}
                      </Button>
                    )}
                    <Button type="submit" size="sm" disabled={!form.isDirty || form.processing}>
                      {form.processing && <LoaderCircleIcon className="mr-1.5 size-4 animate-spin" />}
                      {translateText("Save Changes")}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </form>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ServerIcon className="size-3.5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{translateText("System Overview")}</CardTitle>
                      <CardDescription className="text-xs">{translateText("Live status and server metadata")}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="divide-y p-0 text-sm">
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">{translateText('Status')}</span>
                  <div className="flex items-center gap-2">
                    <ServerStatus server={server} />
                  </div>
                </div>

                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">{translateText("Server ID")}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-foreground">#{server.id}</span>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => copyId(String(server.id))}
                            aria-label={translateText("Copy server ID")}
                          >
                            {idCopied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {idCopied ? translateText("Copied!") : translateText("Copy server ID")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">{translateText('Provider')}</span>
                  <Badge variant="outline" className="gap-1.5 capitalize font-medium">
                    <CloudIcon className="size-3 text-muted-foreground" />
                    {server.provider}
                  </Badge>
                </div>

                {server.os && (
                  <div className="flex items-center justify-between px-6 py-3">
                    <span className="text-muted-foreground">{translateText("Operating System")}</span>
                    <span className="text-xs font-medium text-foreground">{server.os}</span>
                  </div>
                )}

                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">{translateText("Created")}</span>
                  <span className="text-xs text-muted-foreground">
                    <DateTime date={server.created_at} />
                  </span>
                </div>

                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">{translateText("Last Update Check")}</span>
                  <span className="text-xs text-muted-foreground">
                    {server.last_update_check ? <DateTime date={server.last_update_check} /> : translateText("Never")}
                  </span>
                </div>

                {server.updates !== null && server.updates !== undefined && (
                  <div className="flex items-center justify-between px-6 py-3">
                    <span className="text-muted-foreground">{translateText("Available Updates")}</span>
                    {server.updates > 0 ? (
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <Link href={withQuery(`/servers/${server.id}/update`, { start: 1 })}>
                          <Badge variant="warning" className="cursor-pointer hover:opacity-90">
                            {server.updates} {translateText("packages")}
                          </Badge>
                        </Link>
                      </Button>
                    ) : (
                      <Badge variant="outline">{translateText("0 packages")}</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <TerminalIcon className="size-3.5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{translateText("SSH Access")}</CardTitle>
                      <CardDescription className="text-xs">{translateText("Terminal connection and keys")}</CardDescription>
                    </div>
                  </div>
                  <ConnectSshDialog server={server}>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs cursor-pointer">
                      <KeyRoundIcon className="size-3.5" />
                      <span>{translateText('Connect')}</span>
                    </Button>
                  </ConnectSshDialog>
                </div>
              </CardHeader>

              <CardContent className="space-y-3.5 p-6 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">{translateText("Quick SSH Command")}</Label>
                  <CopyableField value={sshCommand} className="h-9 font-mono text-xs" />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground font-medium">{translateText("Server Public Key")}</Label>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground" asChild>
                      <Link href={`/servers/${server.id}/ssh-keys`}>
                        {translateText("Manage Keys →")}
                      </Link>
                    </Button>
                  </div>
                  <CopyableField value={server.public_key} mono masked className="h-9" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/[0.02]">
              <CardHeader className="p-6 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <ShieldAlertIcon className="size-3.5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-destructive">{translateText("Danger Zone")}</CardTitle>
                    <CardDescription className="text-xs">{translateText("Transfer ownership or permanently remove this server")}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="divide-y p-0 text-sm">
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground text-sm">{translateText("Transfer to Project")}</p>
                    <p className="text-muted-foreground text-xs">
                      {translateText("Move this server and all its attached sites and resources to another project.")}
                    </p>
                  </div>
                  <TransferServer server={server}>
                    <Button variant="outline" size="sm" className="shrink-0">
                      {translateText("Transfer")}
                    </Button>
                  </TransferServer>
                </div>

                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-destructive text-sm">{translateText("Remove Server")}</p>
                    <p className="text-muted-foreground text-xs">
                      {server.is_self
                        ? translateText("This server hosts Pure itself and cannot be removed.")
                        : translateText("Remove this server from Pure. The cloud instance remains active on your provider.")}
                    </p>
                  </div>
                  {server.is_self ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground font-medium shrink-0">
                      {translateText("Protected")}
                    </Badge>
                  ) : (
                    <DeleteServer server={server}>
                      <Button variant="destructive" size="sm" className="shrink-0">
                        {translateText('Remove')}
                      </Button>
                    </DeleteServer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </ServerLayout>
  );
}
