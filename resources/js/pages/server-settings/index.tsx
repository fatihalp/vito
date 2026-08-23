import { Head, useForm, usePage } from '@inertiajs/react';
import { Server } from '@/types/server';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import ServerLayout from '@/layouts/server/layout';
import { LoaderCircleIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ServerStatus from '@/pages/servers/components/status';
import DateTime from '@/components/date-time';
import CopyableBadge from '@/components/copyable-badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import DeleteServer from '@/pages/servers/components/delete-server';
import TransferServer from '@/pages/servers/components/transfer-server';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ServerRole } from '@/lib/server-roles';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import { FormEvent } from 'react';

export default function ServerSettings() {
  const configs = useConfigs()!;
  const page = usePage<{
    server: Server;
  }>();

  const server = page.props.server;

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
    form.patch(route('server-settings.update', { server: server.id }));
  };

  return (
    <ServerLayout>
      <Head title={`Settings - ${server.name}`} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title="Settings" description="Manage server configuration, network settings, and project assignment." />
        </HeaderContainer>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Card>
              <CardHeader className="p-6 pb-4">
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Update server details and network settings</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-5">
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Server Name</Label>
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
                      <Label htmlFor="role">Server Role</Label>
                      <Select
                        value={form.data.role}
                        onValueChange={(value: typeof form.data.role) => form.setData('role', value)}
                      >
                        <SelectTrigger id="role" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {configs.server_roles.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <InputError message={form.errors.role} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="stage">Environment Stage</Label>
                      <Select
                        value={form.data.stage}
                        onValueChange={(value: 'prod' | 'beta' | 'alfa') => form.setData('stage', value)}
                      >
                        <SelectTrigger id="stage" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prod">Production</SelectItem>
                          <SelectItem value="beta">Beta</SelectItem>
                          <SelectItem value="alfa">Alpha</SelectItem>
                        </SelectContent>
                      </Select>
                      <InputError message={form.errors.stage} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2 grid gap-2">
                      <Label htmlFor="ip">Public IP Address</Label>
                      <Input
                        id="ip"
                        value={form.data.ip}
                        onChange={(e) => form.setData('ip', e.target.value)}
                        placeholder="1.2.3.4"
                      />
                      <InputError message={form.errors.ip} />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="port">SSH Port</Label>
                      <Input
                        id="port"
                        value={form.data.port}
                        onChange={(e) => form.setData('port', e.target.value)}
                        placeholder="22"
                      />
                      <InputError message={form.errors.port} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="local_ip">Private / Local IP</Label>
                    <Input
                      id="local_ip"
                      value={form.data.local_ip ?? ''}
                      onChange={(e) => form.setData('local_ip', e.target.value)}
                      placeholder="e.g. 10.0.0.1"
                    />
                    <InputError message={form.errors.local_ip} />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3">
                    {form.isDirty && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.reset()}
                      >
                        Reset
                      </Button>
                    )}
                    <Button type="submit" size="sm" disabled={!form.isDirty || form.processing}>
                      {form.processing && <LoaderCircleIcon className="mr-1.5 size-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardHeader className="p-6 pb-4">
                <CardTitle>System Information</CardTitle>
                <CardDescription>Status and metadata</CardDescription>
              </CardHeader>
              <CardContent className="divide-y p-0 text-sm">
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">Status</span>
                  <ServerStatus server={server} />
                </div>
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">Server ID</span>
                  <span className="font-mono text-xs">#{server.id}</span>
                </div>
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">Provider</span>
                  <Badge variant="outline" className="capitalize">{server.provider}</Badge>
                </div>
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-muted-foreground text-xs">
                    <DateTime date={server.created_at} />
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-3">
                  <span className="text-muted-foreground">Last Update Check</span>
                  <span className="text-muted-foreground text-xs">
                    {server.last_update_check ? <DateTime date={server.last_update_check} /> : '-'}
                  </span>
                </div>
                {server.updates !== null && server.updates !== undefined && (
                  <div className="flex items-center justify-between px-6 py-3">
                    <span className="text-muted-foreground">Available Updates</span>
                    <Badge variant={server.updates > 0 ? 'warning' : 'outline'}>
                      {server.updates} packages
                    </Badge>
                  </div>
                )}
                <div className="flex flex-col gap-1.5 px-6 py-3.5">
                  <span className="text-muted-foreground text-xs font-medium">SSH Public Key</span>
                  <CopyableBadge text={server.public_key} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Transfer or permanently delete this server</CardDescription>
              </CardHeader>
              <CardContent className="divide-y p-0 text-sm">
                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground text-sm">Transfer to Project</p>
                    <p className="text-muted-foreground text-xs">
                      Move this server and its resources to another project.
                    </p>
                  </div>
                  <TransferServer server={server}>
                    <Button variant="outline" size="sm" className="shrink-0">
                      Transfer
                    </Button>
                  </TransferServer>
                </div>

                <div className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="space-y-0.5">
                    <p className="font-medium text-destructive text-sm">Delete Server</p>
                    <p className="text-muted-foreground text-xs">
                      Permanently remove this server and all its data.
                    </p>
                  </div>
                  <DeleteServer server={server}>
                    <Button variant="destructive" size="sm" className="shrink-0">
                      Delete
                    </Button>
                  </DeleteServer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </ServerLayout>
  );
}
