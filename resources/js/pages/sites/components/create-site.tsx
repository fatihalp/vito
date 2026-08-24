import { ReactNode, useState, FormEventHandler, useEffect, useMemo } from 'react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  GlobeIcon,
  GitBranchIcon,
  LoaderCircleIcon,
  PlusIcon,
  ServerIcon,
  Settings2Icon,
} from 'lucide-react';
import { useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import SourceControlSelect from '@/pages/source-controls/components/source-control-select';
import { Server } from '@/types/server';
import ServerSelect from '@/pages/servers/components/server-select';
import ServiceVersionSelect from '@/pages/services/components/service-version-select';
import { DynamicFieldConfig } from '@/types/dynamic-field-config';
import DynamicField from '@/components/ui/dynamic-field';
import DatabaseSelect from '@/pages/databases/components/database-select';
import DatabaseUserSelect from '@/pages/database-users/components/database-user-select';
import SelectRepo from '@/pages/source-controls/components/select-repo';
import SelectBranch from '@/pages/source-controls/components/select-branch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DomainPicker, { DomainPickerValue, emptyDomainPickerValue } from '@/pages/sites/components/domain-picker';
import { getSiteTypeIcon } from '@/components/icons/framework-icons';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { SharedData } from '@/types';

type DatabaseServerItem = {
  id: number;
  name: string;
  ip: string;
  role: string;
  is_current: boolean;
};

type SiteCreationDefaults = {
  php_version: string | null;
  source_control_id: number | null;
  has_database?: boolean;
  database_servers?: DatabaseServerItem[];
};

type CreateSiteForm = {
  server: string;
  type: string;
  domain: string;
  dns_provider_id: string;
  provider_domain_id: string;
  create_dns_record: boolean;
  dns_record_proxied: boolean;
  php_version: string;
  source_control: string;
  repository: string;
  branch: string;
  connect_database: boolean;
  database_server_id: string;
  database_action: 'new' | 'existing';
  database_id: string;
  database_name: string;
  [key: string]: string | number | boolean | string[] | undefined;
};

type SiteTypePreset = {
  key: string;
  actualType: string;
  label: string;
  category: 'php' | 'javascript' | 'static' | 'other';
  description: string;
  defaults?: Record<string, unknown>;
};

const SITE_TYPE_PRESETS: SiteTypePreset[] = [
  { key: 'laravel', actualType: 'laravel', label: 'Laravel', category: 'php', description: 'The PHP framework for web artisans' },
  { key: 'symfony', actualType: 'php', label: 'Symfony', category: 'php', description: 'High-performance PHP framework', defaults: { web_directory: 'public' } },
  { key: 'statamic', actualType: 'laravel', label: 'Statamic', category: 'php', description: 'Flat-first, Git-powered CMS for Laravel', defaults: { web_directory: 'public' } },
  { key: 'wordpress', actualType: 'wordpress', label: 'WordPress', category: 'php', description: 'The world’s most popular blogging & CMS platform' },
  { key: 'phpmyadmin', actualType: 'phpmyadmin', label: 'phpMyAdmin', category: 'php', description: 'Web interface for MySQL & MariaDB administration' },
  { key: 'php', actualType: 'php', label: 'PHP', category: 'php', description: 'Standard PHP application with repository deployment' },
  { key: 'phpblank', actualType: 'phpblank', label: 'PHP Blank', category: 'php', description: 'Empty PHP site without Git repository' },

  { key: 'nextjs', actualType: 'nodesite', label: 'Next.js', category: 'javascript', description: 'React framework for production-grade web apps' },
  { key: 'nuxtjs', actualType: 'nodesite', label: 'Nuxt.js', category: 'javascript', description: 'Intuitive Vue framework for web applications' },
  { key: 'node', actualType: 'nodesite', label: 'Node.js', category: 'javascript', description: 'Node.js server runtime application' },
  { key: 'bun', actualType: 'bunsite', label: 'Bun', category: 'javascript', description: 'All-in-one JavaScript runtime & toolkit' },

  { key: 'html', actualType: 'blank', label: 'HTML', category: 'static', description: 'Static HTML, CSS, and client-side JavaScript' },

  { key: 'loadbalancer', actualType: 'loadbalancer', label: 'Load Balancer', category: 'other', description: 'Distribute HTTP/HTTPS traffic across multiple servers' },
  { key: 'blank', actualType: 'blank', label: 'Other', category: 'other', description: 'Blank site configured as custom reverse proxy' },
];

const CATEGORY_TITLES: Record<string, string> = {
  php: 'PHP',
  javascript: 'JavaScript',
  static: 'Static',
  other: 'Other',
};

export default function CreateSite({
  server,
  defaultOpen,
  onOpenChange,
  children,
}: {
  server?: Server;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const configs = useConfigs()!;
  const page = usePage<SharedData>();
  const [open, setOpen] = useState(defaultOpen || false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('laravel');
  const [dbServers, setDbServers] = useState<DatabaseServerItem[]>([]);

  useEffect(() => {
    if (defaultOpen !== undefined) {
      setOpen(defaultOpen);
    }
  }, [defaultOpen]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => setStep(1), 200);
    }
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  };

  const form = useForm<CreateSiteForm>({
    server: server?.id.toString() || '',
    type: 'laravel',
    ...emptyDomainPickerValue(),
    php_version: '',
    source_control: '',
    repository: '',
    branch: 'main',
    connect_database: false,
    database_server_id: server?.id.toString() || '',
    database_action: 'new',
    database_id: '',
    database_name: '',
  });

  const domainPickerValue: DomainPickerValue = {
    domain: form.data.domain,
    dns_provider_id: form.data.dns_provider_id,
    provider_domain_id: form.data.provider_domain_id,
    create_dns_record: form.data.create_dns_record,
    dns_record_proxied: form.data.dns_record_proxied,
  };

  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleDomainChange = (next: DomainPickerValue) => {
    form.setData((data) => ({ ...data, ...next }));
  };

  const selectSiteType = (preset: SiteTypePreset) => {
    setSelectedPresetKey(preset.key);
    const backendType = configs.site.types[preset.actualType] ? preset.actualType : preset.key;
    form.setData((prev) => ({
      ...prev,
      type: backendType,
      ...(preset.defaults || {}),
    }));
    setStep(2);
  };

  const isAdvancedField = (field: DynamicFieldConfig) => {
    if (field.name === 'web_directory' || field.name === 'package_manager') {
      return true;
    }
    if (['laravel', 'php', 'phpblank'].includes(form.data.type)) {
      if (field.type === 'tooling' || field.type === 'tooling-selector') {
        return true;
      }
    }
    return false;
  };

  const currentTypeForm = configs.site.types[form.data.type]?.form ?? [];
  const primaryFields = useMemo(
    () =>
      currentTypeForm.filter(
        (f) =>
          !isAdvancedField(f) &&
          !['source_control', 'repository', 'branch', 'php_version', 'database', 'database_user', 'database_password'].includes(f.name),
      ),
    [currentTypeForm, form.data.type],
  );
  const advancedFields = useMemo(() => currentTypeForm.filter((f) => isAdvancedField(f)), [currentTypeForm, form.data.type]);

  const hasAdvancedErrors = useMemo(() => {
    return advancedFields.some((f) => {
      const err = (form.errors as Record<string, string | undefined>)[f.name];
      const versionErr = (form.errors as Record<string, string | undefined>)[`${f.name}_version`];
      return Boolean(err || versionErr);
    });
  }, [advancedFields, form.errors]);

  useEffect(() => {
    if (hasAdvancedErrors) {
      setShowAdvanced(true);
    }
  }, [hasAdvancedErrors]);

  useEffect(() => {
    const targetServerId = form.data.server || server?.id.toString();
    if (!targetServerId) return;

    axios
      .get<SiteCreationDefaults>(route('sites.creation-defaults', { server: targetServerId }))
      .then(({ data }) => {
        if (data.php_version && !form.data.php_version) {
          form.setData('php_version', data.php_version);
        }
        if (data.source_control_id && !form.data.source_control) {
          form.setData('source_control', data.source_control_id.toString());
        }
        if (data.database_servers) {
          setDbServers(data.database_servers);
          if (!form.data.database_server_id) {
            const defaultDbServer = data.database_servers.find((s) => s.is_current) || data.database_servers[0];
            if (defaultDbServer) {
              form.setData('database_server_id', defaultDbServer.id.toString());
            }
          }
        }
      })
      .catch(() => {});
  }, [form.data.server, server?.id]);

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    form.post(route('sites.store', { server: form.data.server || server?.id }));
  };

  useEffect(() => {
    const typeConfig = configs.site.types[form.data.type];
    const sourceControlFields = ['source_control', 'repository', 'branch'];
    const sourceControlOff = typeConfig?.form?.some((f) => f.name === 'use_source_control') && !form.data.use_source_control;

    if (typeConfig?.form) {
      typeConfig.form.forEach((field: DynamicFieldConfig) => {
        if (sourceControlOff && sourceControlFields.includes(field.name)) {
          return;
        }
        if (field.default !== undefined) {
          if (form.data[field.name] === '' || form.data[field.name] === undefined) {
            form.setData(field.name, field.default);
          }
        }
      });
    }
  }, [form.data.type, form.data.use_source_control, form.setData, configs]);

  type ActiveTool = { toolId: string; kind: 'tooling' | 'tooling-picker' | 'tooling-selector' };
  const activeTools = useMemo<ActiveTool[]>(() => {
    const typeConfig = configs.site.types[form.data.type];
    const result: ActiveTool[] = [];
    for (const f of typeConfig?.form ?? []) {
      if (f.type !== 'tooling' && f.type !== 'tooling-picker' && f.type !== 'tooling-selector') continue;
      const raw = f.options;
      const ids = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
      for (const id of ids) result.push({ toolId: id, kind: f.type });
    }
    return result;
  }, [configs, form.data.type]);

  const currentTypeConfig = configs.site.types[form.data.type];
  const selectedPreset = SITE_TYPE_PRESETS.find((p) => p.key === selectedPresetKey) || {
    key: form.data.type,
    actualType: form.data.type,
    label: currentTypeConfig?.label || form.data.type,
    category: 'other',
    description: '',
  };

  const isPhpType = ['laravel', 'php', 'phpblank', 'wordpress', 'phpmyadmin'].includes(form.data.type) || selectedPreset.category === 'php';
  const supportsSourceControl =
    ['laravel', 'php', 'nodesite', 'bunsite'].includes(form.data.type) ||
    currentTypeForm.some((f) => f.name === 'source_control' || f.name === 'repository');

  const getFormField = (field: DynamicFieldConfig) => {
    return (
      <DynamicField
        key={`field-${field.name}`}
        value={form.data[field.name] as string | number | boolean | string[] | undefined}
        onChange={(value) => form.setData(field.name, value)}
        config={field}
        error={(form.errors as Record<string, string | undefined>)[field.name]}
      />
    );
  };

  const groupedPresets = useMemo(() => {
    const groups: Record<string, SiteTypePreset[]> = {
      php: [],
      javascript: [],
      static: [],
      other: [],
    };

    SITE_TYPE_PRESETS.forEach((preset) => {
      if (groups[preset.category]) {
        groups[preset.category].push(preset);
      }
    });

    return groups;
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full lg:max-w-2xl overflow-y-auto max-h-screen p-0 flex flex-col">
        {step === 1 && (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b">
              <SheetTitle className="text-xl font-bold tracking-tight">Create a new site</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                Select the type of site you want to create. Each type has different configurations and features.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {Object.entries(groupedPresets).map(([categoryKey, presets]) => {
                if (presets.length === 0) return null;

                return (
                  <div key={categoryKey} className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                      {CATEGORY_TITLES[categoryKey] || categoryKey}
                    </h3>
                    <div className="divide-y divide-border/40 rounded-xl border bg-card overflow-hidden">
                      {presets.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => selectSiteType(preset)}
                          className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="size-8 flex items-center justify-center shrink-0">
                              {getSiteTypeIcon(preset.key, 28)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {preset.label}
                              </span>
                              {preset.description && (
                                <p className="text-xs text-muted-foreground truncate">{preset.description}</p>
                              )}
                            </div>
                          </div>
                          <ChevronRightIcon className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <SheetFooter className="p-4 border-t bg-muted/20">
              <SheetClose asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  Cancel
                </Button>
              </SheetClose>
            </SheetFooter>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex items-center justify-between gap-4 mb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="h-8 -ml-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  <span>Change type</span>
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 flex items-center justify-center shrink-0">
                  {getSiteTypeIcon(selectedPreset.key, 32)}
                </div>
                <div>
                  <SheetTitle className="text-lg font-bold">Install a {selectedPreset.label} application</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Configure repository, runtime, domain, and database settings
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Form id="create-site-form" className="p-6 flex-1 overflow-y-auto space-y-5" onSubmit={submit}>
              <FormFields className="space-y-4">
                {server === undefined && (
                  <FormField>
                    <Label htmlFor="server">Server</Label>
                    <ServerSelect
                      value={form.data.server}
                      onValueChange={(value) => form.setData('server', value ? value.id.toString() : '')}
                    />
                    <InputError message={form.errors.server} />
                  </FormField>
                )}

                <FormField>
                  <DomainPicker
                    value={domainPickerValue}
                    onChange={handleDomainChange}
                    serverIp={server?.ip}
                    error={form.errors.domain}
                  />
                </FormField>

                {supportsSourceControl && (
                  <div className="space-y-3 rounded-xl border bg-muted/15 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1.4fr] items-end gap-2 sm:gap-3">
                      <FormField className="w-full">
                        <Label htmlFor="source_control" className="text-xs">
                          Source control provider
                        </Label>
                        <SourceControlSelect
                          id="source_control"
                          value={form.data.source_control}
                          onValueChange={(value) => form.setData('source_control', value)}
                        />
                        <InputError message={form.errors.source_control} />
                      </FormField>

                      <div className="hidden sm:flex items-center justify-center pb-2 text-muted-foreground font-mono text-lg">
                        /
                      </div>

                      <FormField className="w-full">
                        <Label htmlFor="repository" className="text-xs">
                          Repository
                        </Label>
                        <SelectRepo
                          sourceControlId={form.data.source_control}
                          value={form.data.repository}
                          onValueChange={(value) => form.setData('repository', value)}
                          placeholder="owner/repository"
                        />
                        <InputError message={form.errors.repository} />
                      </FormField>
                    </div>

                    <FormField>
                      <Label htmlFor="branch" className="text-xs">
                        Branch
                      </Label>
                      <SelectBranch
                        sourceControlId={form.data.source_control}
                        repository={form.data.repository}
                        value={form.data.branch}
                        onValueChange={(value) => form.setData('branch', value)}
                        placeholder="e.g. main, master, develop"
                      />
                      <InputError message={form.errors.branch} />
                    </FormField>
                  </div>
                )}

                {isPhpType && (
                  <FormField>
                    <Label htmlFor="php_version">PHP Version</Label>
                    <ServiceVersionSelect
                      id="php_version"
                      serverId={parseInt(form.data.server || server?.id?.toString() || '0')}
                      service="php"
                      value={form.data.php_version}
                      onValueChange={(value) => form.setData('php_version', value)}
                      autoSelectSingle
                    />
                    <InputError message={form.errors.php_version} />
                  </FormField>
                )}

                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="connect-db-toggle" className="text-sm font-semibold cursor-pointer">
                        Connect to database
                      </Label>
                      <p className="text-xs text-muted-foreground">Select or create a new database to connect to your site.</p>
                    </div>
                    <Switch
                      id="connect-db-toggle"
                      checked={form.data.connect_database}
                      onCheckedChange={(checked) => form.setData('connect_database', checked)}
                    />
                  </div>

                  {form.data.connect_database && (
                    <div className="pt-2 border-t space-y-3 mt-3 animate-in fade-in-50 duration-200">
                      {dbServers.length > 1 && (
                        <FormField>
                          <Label htmlFor="database_server_id" className="text-xs">
                            Database Server
                          </Label>
                          <Select
                            value={form.data.database_server_id}
                            onValueChange={(val) => form.setData('database_server_id', val)}
                          >
                            <SelectTrigger id="database_server_id" className="h-9 text-xs">
                              <SelectValue placeholder="Select database server" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {dbServers.map((s) => (
                                  <SelectItem key={`db-srv-${s.id}`} value={s.id.toString()} className="text-xs">
                                    <span className="font-medium">{s.name}</span>
                                    <span className="text-muted-foreground ml-1.5 font-mono text-[11px]">({s.ip})</span>
                                    {s.is_current && (
                                      <Badge variant="outline" className="ml-2 text-[10px] h-4">
                                        Current
                                      </Badge>
                                    )}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <InputError message={form.errors.database_server_id} />
                        </FormField>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={form.data.database_action === 'new' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => form.setData('database_action', 'new')}
                        >
                          Create new database
                        </Button>
                        <Button
                          type="button"
                          variant={form.data.database_action === 'existing' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={() => form.setData('database_action', 'existing')}
                        >
                          Select existing database
                        </Button>
                      </div>

                      {form.data.database_action === 'new' ? (
                        <FormField>
                          <Label htmlFor="database_name" className="text-xs">
                            Database Name <span className="text-muted-foreground font-normal">(Optional)</span>
                          </Label>
                          <Input
                            id="database_name"
                            name="database_name"
                            placeholder="e.g. forge or leave blank for auto-name"
                            value={form.data.database_name}
                            onChange={(e) => form.setData('database_name', e.target.value)}
                            className="h-9 text-xs"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">
                            A dedicated database user and secure password will be generated and injected into your site's .env automatically.
                          </p>
                        </FormField>
                      ) : (
                        <FormField>
                          <Label htmlFor="database_id" className="text-xs">
                            Existing Database
                          </Label>
                          <DatabaseSelect
                            id="database_id"
                            serverId={parseInt(form.data.database_server_id || server?.id?.toString() || '0')}
                            value={form.data.database_id}
                            onValueChange={(value) => form.setData('database_id', value)}
                            createWithUser={false}
                          />
                          <InputError message={form.errors.database_id} />
                        </FormField>
                      )}
                    </div>
                  )}
                </div>

                {primaryFields.map((config) => getFormField(config))}

                {advancedFields.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer py-1"
                    >
                      <ChevronRightIcon
                        className={cn('size-3.5 transition-transform duration-200', showAdvanced && 'rotate-90')}
                      />
                      <span>{showAdvanced ? 'Hide advanced settings' : 'Advanced settings (Package manager, Node.js, Web directory)'}</span>
                    </button>

                    {showAdvanced && (
                      <div className="mt-3 space-y-4 rounded-xl border border-dashed p-4 bg-muted/15 animate-in fade-in-50 duration-200">
                        {advancedFields.map((config) => getFormField(config))}
                      </div>
                    )}
                  </div>
                )}
              </FormFields>
            </Form>

            <SheetFooter className="p-4 border-t bg-muted/20 flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)} disabled={form.processing} className="text-xs">
                <ArrowLeftIcon className="size-3.5 mr-1" />
                Back
              </Button>

              <div className="flex items-center gap-2">
                <SheetClose asChild>
                  <Button variant="ghost" size="sm" disabled={form.processing} className="text-xs">
                    Cancel
                  </Button>
                </SheetClose>
                <Button
                  type="submit"
                  form="create-site-form"
                  disabled={form.processing || (!server && !form.data.server)}
                  size="sm"
                  className="text-xs"
                >
                  {form.processing && <LoaderCircleIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Create site
                </Button>
              </div>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
