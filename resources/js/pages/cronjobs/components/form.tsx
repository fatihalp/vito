import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMemo, FormEvent, useState, useEffect } from 'react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CronJob } from '@/types/cronjob';
import { SharedData } from '@/types';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { useConfigs } from '@/stores/bootstrap-store';
import { cn } from '@/lib/utils';

export { CRONJOB_TEMPLATES } from '@/config/cron-templates';
import { CRONJOB_TEMPLATES } from '@/config/cron-templates';

export default function CronJobForm({
  open,
  onOpenChange,
  serverId,
  site,
  cronJob,
  templateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  site?: Site;
  cronJob?: CronJob;
  templateId?: string;
}) {
  const page = usePage<SharedData & { server: Server; sites?: Array<{ id: number; domain: string }>; ssh_users?: string[] }>();
  const configs = useConfigs()!;
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const sshUsers = useMemo(() => {
    const base = site ? (page.props.ssh_users ?? []) : page.props.server.ssh_users;
    if (cronJob?.user && !base.includes(cronJob.user)) {
      return [...base, cronJob.user];
    }
    return base;
  }, [site, page.props.ssh_users, page.props.server.ssh_users, cronJob?.user]);

  const defaultUser = cronJob?.user || site?.user || (sshUsers && sshUsers.length > 0 ? sshUsers[0] : '');

  const form = useForm<{
    name: string;
    command: string;
    user: string;
    frequency: string;
    custom: string;
    site_id: string;
  }>({
    name: cronJob?.name || '',
    command: cronJob?.command || '',
    user: cronJob?.user || defaultUser,
    frequency: cronJob ? (configs.cronjob_intervals[cronJob.frequency] ? cronJob.frequency : 'custom') : '* * * * *',
    custom: cronJob?.frequency || '',
    site_id: cronJob?.site_id?.toString() || site?.id?.toString() || '0',
  });

  useEffect(() => {
    if (open) {
      if (cronJob) {
        form.setData({
          name: cronJob.name || '',
          command: cronJob.command || '',
          user: cronJob.user || defaultUser,
          frequency: configs.cronjob_intervals[cronJob.frequency] ? cronJob.frequency : 'custom',
          custom: cronJob.frequency || '',
          site_id: cronJob.site_id?.toString() || '0',
        });
        setSelectedTemplate('');
      } else if (templateId) {
        const initialTemplate = CRONJOB_TEMPLATES.find((t) => t.id === templateId);
        if (initialTemplate) {
          setSelectedTemplate(initialTemplate.id);
          form.setData({
            name: initialTemplate.name,
            command: initialTemplate.getCommand(site?.path),
            user: defaultUser,
            frequency: initialTemplate.frequency,
            custom: initialTemplate.custom || '',
            site_id: site?.id?.toString() || '0',
          });
        }
      } else {
        form.setData({
          name: '',
          command: '',
          user: defaultUser,
          frequency: '* * * * *',
          custom: '',
          site_id: site?.id?.toString() || '0',
        });
        setSelectedTemplate('');
      }
    }
  }, [open, cronJob, site, templateId]);

  const applyTemplate = (tmplId: string) => {
    const template = CRONJOB_TEMPLATES.find((t) => t.id === tmplId);
    if (!template) return;
    setSelectedTemplate(tmplId);

    const command = template.getCommand(site?.path);
    form.setData({
      ...form.data,
      name: !form.data.name || CRONJOB_TEMPLATES.some((t) => t.name === form.data.name) ? template.name : form.data.name,
      command,
      frequency: template.frequency,
      custom: template.custom || (template.frequency === 'custom' ? form.data.custom : ''),
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (cronJob) {
      const routeName = site ? 'cronjobs.site.update' : 'cronjobs.update';
      const routeParams = site ? { server: serverId, site: site.id, cronJob: cronJob.id } : { server: serverId, cronJob: cronJob.id };

      form.put(route(routeName, routeParams), {
        onSuccess: () => onOpenChange(false),
      });
      return;
    }

    const routeName = site ? 'cronjobs.site.store' : 'cronjobs.store';
    const routeParams = site ? { server: serverId, site: site.id } : { server: serverId };

    form.post(route(routeName, routeParams), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{cronJob ? 'Edit' : 'Create'} cron job</DialogTitle>
          <DialogDescription className="sr-only">{cronJob ? 'Edit' : 'Create new'} cron job</DialogDescription>
        </DialogHeader>
        <Form id="cronjob-form" onSubmit={submit} className="p-4">
          <FormFields>
            {!cronJob && (
              <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-foreground text-xs font-semibold">Preset Templates</Label>
                    <span className="text-muted-foreground text-[11px]">(Laravel Recommendations)</span>
                  </div>
                  {selectedTemplate && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-6 px-1.5 text-xs"
                      onClick={() => {
                        setSelectedTemplate('');
                        form.setData({
                          ...form.data,
                          name: '',
                          command: '',
                          frequency: '* * * * *',
                          custom: '',
                        });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {CRONJOB_TEMPLATES.map((t) => {
                    const isSelected = selectedTemplate === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t.id)}
                        className={cn(
                          'hover:bg-accent/50 relative flex flex-col items-start rounded-md border p-2 text-left transition-colors',
                          isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 bg-background text-foreground',
                        )}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <span className="truncate text-xs font-semibold">{t.label}</span>
                          {t.isOfficial && <span className="bg-primary/20 text-primary rounded px-1 py-0.5 text-[9px] font-medium">Official</span>}
                        </div>
                        <span className="text-muted-foreground line-clamp-1 font-mono text-[10px]">
                          {t.frequency === 'custom' ? t.custom : configs.cronjob_intervals[t.frequency] || t.frequency}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input
                type="text"
                id="name"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                placeholder="Optional name for the cron job"
              />
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
                placeholder={site ? `cd ${site.path} && php artisan schedule:run >> /dev/null 2>&1` : 'php artisan schedule:run'}
              />
              <InputError message={form.errors.command} />
            </FormField>

            {page.props.sites && !site && (
              <FormField>
                <Label htmlFor="site_id">Belongs to</Label>
                <Select value={form.data.site_id} onValueChange={(value) => form.setData('site_id', value)}>
                  <SelectTrigger id="site_id">
                    <SelectValue placeholder="Select a site (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="0">Server</SelectItem>
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
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={form.data.frequency} onValueChange={(value) => form.setData('frequency', value)}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select a frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(configs.cronjob_intervals).map(([key, value]) => (
                      <SelectItem key={`frequency-${key}`} value={key}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.frequency} />
            </FormField>

            {form.data.frequency === 'custom' && (
              <FormField>
                <Label htmlFor="custom_frequency">Custom frequency (crontab)</Label>
                <Input
                  id="custom_frequency"
                  name="custom_frequency"
                  value={form.data.custom}
                  onChange={(e) => form.setData('custom', e.target.value)}
                  placeholder="* * * * *"
                />
                <InputError message={form.errors.custom} />
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
                    {sshUsers.map((user) => (
                      <SelectItem key={`user-${user}`} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.user} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button form="cronjob-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
