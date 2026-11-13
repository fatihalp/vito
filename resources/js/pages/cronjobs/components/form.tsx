import { useTranslate } from '@/hooks/use-translate';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMemo, FormEvent, useState, useEffect } from 'react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CronJob } from '@/types/cronjob';
import { SharedData } from '@/types';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { useConfigs } from '@/stores/bootstrap-store';

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
  const translateText = useTranslate();
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
      const url = site ? `/servers/${serverId}/sites/${site.id}/cronjobs/${cronJob.id}` : `/servers/${serverId}/cronjobs/${cronJob.id}`;

      form.put(url, {
        onSuccess: () => onOpenChange(false),
      });
      return;
    }

    const url = site ? `/servers/${serverId}/sites/${site.id}/cronjobs` : `/servers/${serverId}/cronjobs`;

    form.post(url, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{cronJob ? translateText("Edit") : translateText("Create")} {translateText("cron job")}</DialogTitle>
          <DialogDescription className="sr-only">{cronJob ? translateText("Edit") : translateText("Create new")} {translateText("cron job")}</DialogDescription>
        </DialogHeader>
        <Form id="cronjob-form" onSubmit={submit} className="min-h-0 overflow-y-auto p-4">
          <FormFields>
            {!cronJob && (
              <FormField>
                <Label htmlFor="template">{translateText("Start with a template")}</Label>
                <Select
                  value={selectedTemplate || 'custom'}
                  onValueChange={(value) => {
                    if (value === 'custom') {
                      setSelectedTemplate('');
                      return;
                    }
                    applyTemplate(value);
                  }}
                >
                  <SelectTrigger id="template" className="h-auto min-h-9 w-full text-left [&>span]:line-clamp-none [&_span]:whitespace-normal">
                    <SelectValue placeholder={translateText("Write your own command")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="custom">{translateText("Write your own command")}</SelectItem>
                      {CRONJOB_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id} className="[&_span]:whitespace-normal">
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {selectedTemplate && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {CRONJOB_TEMPLATES.find((template) => template.id === selectedTemplate)?.description}
                  </p>
                )}
              </FormField>
            )}

            <FormField>
              <Label htmlFor="name">{translateText("Name (optional)")}</Label>
              <Input
                type="text"
                id="name"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                placeholder={translateText("Optional name for the cron job")}
              />
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="command">{translateText('Command')}</Label>
              <Textarea
                id="command"
                rows={2}
                className="min-h-20 resize-y font-mono text-sm"
                aria-describedby="command-help"
                value={form.data.command}
                onChange={(e) => {
                  setSelectedTemplate('');
                  form.setData('command', e.target.value.replace(/[\r\n]+/g, ' '));
                }}
                placeholder="php artisan schedule:run"
              />
              <InputError message={form.errors.command} />
              {form.data.site_id !== '0' ? (
                <p id="command-help" className="text-muted-foreground text-xs">{translateText("Enter only the command. It runs from the selected site's directory.")}</p>
              ) : (
                <p id="command-help" className="text-muted-foreground text-xs leading-relaxed">
                  {translateText("Select a site to run from its directory, or include the full path in your command.")}
                </p>
              )}
            </FormField>

            {page.props.sites && !site && (
              <FormField>
                <Label htmlFor="site_id">{translateText("Belongs to")}</Label>
                <Select value={form.data.site_id} onValueChange={(value) => form.setData('site_id', value)}>
                  <SelectTrigger id="site_id">
                    <SelectValue placeholder={translateText("Select a site (optional)")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="0">{translateText('Server')}</SelectItem>
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
              <Label htmlFor="frequency">{translateText("Frequency")}</Label>
              <Select value={form.data.frequency} onValueChange={(value) => form.setData('frequency', value)}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder={translateText("Select a frequency")} />
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
              {form.data.command.includes('schedule:run') && form.data.frequency !== '* * * * *' && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Laravel Task Scheduler (<code className="font-mono">schedule:run</code>{translateText(") should run every minute (")}<code className="font-mono">* * * * *</code>{translateText(") to execute scheduled tasks on time.")}
                </p>
              )}
            </FormField>

            {form.data.frequency === 'custom' && (
              <FormField>
                <Label htmlFor="custom_frequency">{translateText("Custom frequency (crontab)")}</Label>
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
              <Label htmlFor="user">{translateText('User')}</Label>
              <Select value={form.data.user} onValueChange={(value) => form.setData('user', value)}>
                <SelectTrigger id="user">
                  <SelectValue placeholder={translateText("Select a user")} />
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
            <Button variant="outline">{translateText('Close')}</Button>
          </DialogClose>
          <Button form="cronjob-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            {translateText('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
