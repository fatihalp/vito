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

export interface WorkerTemplate {
  id: string;
  label: string;
  name: string;
  command: string;
  description: string;
  numprocs?: string;
}

export const WORKER_TEMPLATES: WorkerTemplate[] = [
  {
    id: 'horizon',
    label: 'Laravel Horizon',
    name: 'horizon',
    command: 'php artisan horizon',
    description: 'Laravel Horizon queue manager and supervisor',
    numprocs: '1',
  },
  {
    id: 'queue-work',
    label: 'Queue Worker',
    name: 'queue-worker',
    command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600',
    description: 'Standard Laravel queue processing daemon',
    numprocs: '1',
  },
  {
    id: 'schedule-work',
    label: 'Scheduler',
    name: 'schedule-worker',
    command: 'php artisan schedule:work',
    description: 'Executes Laravel scheduled tasks continuously',
    numprocs: '1',
  },
  {
    id: 'reverb',
    label: 'Reverb (WebSocket)',
    name: 'reverb',
    command: 'php artisan reverb:start',
    description: 'Laravel Reverb WebSocket server',
    numprocs: '1',
  },
  {
    id: 'queue-listen',
    label: 'Queue Listen',
    name: 'queue-listen',
    command: 'php artisan queue:listen',
    description: 'Queue listener with automatic code reloading',
    numprocs: '1',
  },
  {
    id: 'pulse',
    label: 'Laravel Pulse',
    name: 'pulse',
    command: 'php artisan pulse:check',
    description: 'Performance recording worker for Pulse',
    numprocs: '1',
  },
];

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

  const form = useForm<{
    name: string;
    command: string;
    user: string;
    auto_start: boolean;
    auto_restart: boolean;
    numprocs: string;
    site_id: string;
  }>({
    name: worker?.name || '',
    command: worker?.command || '',
    user: worker?.user || defaultUser,
    auto_start: worker?.auto_start ?? true,
    auto_restart: worker?.auto_restart ?? true,
    numprocs: worker?.numprocs?.toString() || '1',
    site_id: worker?.site_id?.toString() || site?.id?.toString() || '0',
  });

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
        });
        setSelectedTemplate('');
      }
    }
  }, [open, worker, site]);

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
              <p className="text-muted-foreground text-sm">`php` command will use the default php cli command</p>
              <p className="text-muted-foreground text-sm">For specific version, use exact path to the php version like `/usr/bin/php8.4`</p>
              <InputError message={form.errors.command} />
            </FormField>

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
              <Select value={form.data.user} onValueChange={(value) => form.setData('user', value)}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {page.props.server.ssh_users.map((user) => (
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
