import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Worker } from '@/types/worker';
import { SharedData } from '@/types';
import { Server } from '@/types/server';
import { Switch } from '@/components/ui/switch';
import { Site } from '@/types/site';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Alert, AlertDescription } from '@/components/ui/alert';

type WorkerTargetServer = {
  id: number;
  name: string;
  ip: string;
  has_process_manager: boolean;
};

import { WORKER_TEMPLATES } from '@/config/worker-templates';

export default function WorkerForm({
  open,
  onOpenChange,
  serverId,
  site,
  worker,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  site?: Site;
  worker?: Worker;
}) {
  const page = usePage<SharedData & { server: Server; sites?: Array<{ id: number; domain: string }> }>();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const defaultUser = site?.user || (page.props.server?.ssh_users && page.props.server.ssh_users.length > 0 ? page.props.server.ssh_users[0] : '');

  const targetServersQuery = useQuery<WorkerTargetServer[]>({
    queryKey: ['worker-target-servers', serverId, site?.id],
    queryFn: async () => (await axios.get(route('workers.target-servers', { server: serverId, site: site?.id }))).data,
    enabled: open && !!site && !worker,
  });
  const targetServers = targetServersQuery.data ?? [];

  const form = useForm<{
    name: string;
    command: string;
    user: string;
    auto_start: boolean;
    auto_restart: boolean;
    numprocs: string;
    site_id: string;
    target_server_id: string;
  }>({
    name: worker?.name || '',
    command: worker?.command || '',
    user: worker?.user || defaultUser,
    auto_start: worker?.auto_start ?? true,
    auto_restart: worker?.auto_restart ?? true,
    numprocs: worker?.numprocs?.toString() || '1',
    site_id: worker?.site_id?.toString() || site?.id?.toString() || '0',
    target_server_id: worker && worker.server_id !== serverId ? worker.server_id.toString() : '',
  });

  const runningExternally = !!site && form.data.target_server_id !== '';

  useEffect(() => {
    if (open) {
      if (worker) {
        form.setData({
          name: worker.name || '',
          command: worker.command || '',
          user: worker.user || defaultUser,
          auto_start: worker.auto_start ?? true,
          auto_restart: worker.auto_restart ?? true,
          numprocs: worker.numprocs?.toString() || '1',
          site_id: worker.site_id?.toString() || '0',
          target_server_id: worker.server_id !== serverId ? worker.server_id.toString() : '',
        });
        setSelectedTemplate('');
      } else {
        form.setData({
          name: '',
          command: '',
          user: defaultUser,
          auto_start: true,
          auto_restart: true,
          numprocs: '1',
          site_id: site?.id?.toString() || '0',
          target_server_id: '',
        });
        setSelectedTemplate('');
      }
    }
  }, [open, worker, site]);

  useEffect(() => {
    if (runningExternally && site && form.data.user !== site.user) {
      form.setData('user', site.user);
    }
  }, [runningExternally, site]);

  const applyTemplate = (templateId: string) => {
    const template = WORKER_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setSelectedTemplate(templateId);
    form.setData({
      ...form.data,
      name: !form.data.name || WORKER_TEMPLATES.some((t) => t.name === form.data.name) ? template.name : form.data.name,
      command: template.command,
      numprocs: template.numprocs || form.data.numprocs || '1',
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (worker) {
      form.put(route('workers.update', { server: serverId, worker: worker.id }), {
        onSuccess: () => onOpenChange(false),
      });
      return;
    }

    form.post(route('workers.store', { server: serverId, site: site?.id }), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{worker ? 'Edit' : 'Create'} worker</DialogTitle>
          <DialogDescription className="sr-only">{worker ? 'Edit' : 'Create new'} worker</DialogDescription>
        </DialogHeader>
        <Form id="worker-form" onSubmit={submit} className="p-4">
          <FormFields>
            {!worker && (
              <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">Preset Templates</Label>
                  {selectedTemplate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedTemplate('');
                        form.setData({ ...form.data, name: '', command: '' });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {WORKER_TEMPLATES.map((t) => {
                    const isSelected = selectedTemplate === t.id || form.data.command === t.command;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t.id)}
                        className={cn(
                          'flex flex-col items-start rounded-md border p-2 text-left transition-colors hover:bg-accent/50',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/60 bg-background text-foreground',
                        )}
                      >
                        <span className="text-xs font-semibold">{t.label}</span>
                        <span className="text-muted-foreground line-clamp-1 font-mono text-[10px]">
                          {t.command}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input type="text" id="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="command">Command</Label>
              <Input
                type="text"
                id="command"
                value={form.data.command}
                onChange={(e) => {
                  setSelectedTemplate('');
                  form.setData('command', e.target.value);
                }}
                placeholder={site ? 'php artisan queue:work' : ''}
              />
              <InputError message={form.errors.command} />
            </FormField>

            {site && !worker && (
              <FormField>
                <Label htmlFor="target_server_id">Run on</Label>
                <Select
                  value={form.data.target_server_id || '__home__'}
                  onValueChange={(value) => form.setData('target_server_id', value === '__home__' ? '' : value)}
                  disabled={targetServersQuery.isFetching}
                >
                  <SelectTrigger id="target_server_id">
                    <SelectValue placeholder={targetServersQuery.isFetching ? 'Loading...' : 'Select where this worker runs'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__home__">{page.props.server.name} (this site's server)</SelectItem>
                      {targetServers.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id.toString()} disabled={!candidate.has_process_manager}>
                          {candidate.name} · {candidate.ip}
                          {!candidate.has_process_manager ? ' (no process manager installed)' : ''}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <InputError message={form.errors.target_server_id} />
                {runningExternally && (
                  <Alert>
                    <AlertDescription>
                      The site's code will be synced to this server (cloned, dependencies installed) before the worker starts, and kept up to date
                      on every deploy.
                    </AlertDescription>
                  </Alert>
                )}
                {targetServers.length === 0 && !targetServersQuery.isFetching && (
                  <p className="text-muted-foreground text-xs">
                    No dedicated queue servers in this project yet. Create one with the "Queue" role to run workers elsewhere.
                  </p>
                )}
              </FormField>
            )}

            {page.props.sites && !site && (
              <FormField>
                <Label htmlFor="site_id">Site</Label>
                <Select value={form.data.site_id} onValueChange={(value) => form.setData('site_id', value)}>
                  <SelectTrigger id="site_id">
                    <SelectValue placeholder="Select a site (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="0">Server (no site)</SelectItem>
                      {page.props.sites.map((siteOption) => (
                        <SelectItem key={`site-${siteOption.id}`} value={siteOption.id.toString()}>
                          {siteOption.domain}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <InputError message={form.errors.site_id} />
              </FormField>
            )}

            <FormField>
              <Label htmlFor="user">User</Label>
              <Select value={form.data.user} onValueChange={(value) => form.setData('user', value)} disabled={runningExternally}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(runningExternally && site ? [site.user] : page.props.server.ssh_users).map((user) => (
                      <SelectItem key={`user-${user}`} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.user} />
            </FormField>

            <FormField>
              <Label htmlFor="numprocs">Numprocs</Label>
              <Input
                id="numprocs"
                name="numprocs"
                value={form.data.numprocs}
                onChange={(e) => form.setData('numprocs', e.target.value)}
                placeholder="1"
              />
              <InputError message={form.errors.numprocs} />
            </FormField>

            <div className="grid grid-cols-2 gap-6">
              <FormField>
                <div className="flex items-center space-x-2">
                  <Switch id="auto_start" checked={form.data.auto_start} onCheckedChange={(value) => form.setData('auto_start', value)} />
                  <Label htmlFor="auto_start">Auto start</Label>
                  <InputError message={form.errors.auto_start} />
                </div>
              </FormField>

              <FormField>
                <div className="flex items-center space-x-2">
                  <Switch id="auto_restart" checked={form.data.auto_restart} onCheckedChange={(value) => form.setData('auto_restart', value)} />
                  <Label htmlFor="auto_restart">Auto restart</Label>
                  <InputError message={form.errors.auto_restart} />
                </div>
              </FormField>
            </div>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button form="worker-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
