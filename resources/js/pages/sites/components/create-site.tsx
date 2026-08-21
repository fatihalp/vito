import { ReactNode, useState, FormEventHandler, useEffect, useMemo } from 'react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LoaderCircle } from 'lucide-react';
import { useForm } from '@inertiajs/react';
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

type SiteCreationDefaults = {
  php_version: string | null;
  source_control_id: number | null;
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
  
  
  
  [key: string]: string | number | boolean | string[] | undefined;
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
  const [open, setOpen] = useState(defaultOpen || false);

  useEffect(() => {
    if (defaultOpen !== undefined) {
      setOpen(defaultOpen);
    }
  }, [defaultOpen]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
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
    branch: '',
  });

  const domainPickerValue: DomainPickerValue = {
    domain: form.data.domain,
    dns_provider_id: form.data.dns_provider_id,
    provider_domain_id: form.data.provider_domain_id,
    create_dns_record: form.data.create_dns_record,
    dns_record_proxied: form.data.dns_record_proxied,
  };

  const handleDomainChange = (next: DomainPickerValue) => {
    form.setData((data) => ({ ...data, ...next }));
  };

  
  
  useEffect(() => {
    if (!form.data.server) return;

    axios
      .get<SiteCreationDefaults>(route('sites.creation-defaults', { server: form.data.server }))
      .then(({ data }) => {
        if (data.php_version && !form.data.php_version) {
          form.setData('php_version', data.php_version);
        }
        if (data.source_control_id && !form.data.source_control) {
          form.setData('source_control', data.source_control_id.toString());
        }
      })
      .catch(() => {
        
      });
  }, [form.data.server]);

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    form.post(route('sites.store', { server: form.data.server }));
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

  const hasSourceControlToggle = useMemo<boolean>(
    () => (configs.site.types[form.data.type]?.form ?? []).some((f) => f.name === 'use_source_control'),
    [configs, form.data.type],
  );
  const sourceControlEnabled = !hasSourceControlToggle || !!form.data.use_source_control;

  useEffect(() => {
    if (hasSourceControlToggle && !form.data.use_source_control) {
      if (form.data.source_control) form.setData('source_control', '');
      if (form.data.repository) form.setData('repository', '');
      if (form.data.branch) form.setData('branch', '');
    }
  }, [hasSourceControlToggle, form.data.use_source_control, form.data.source_control, form.data.repository, form.data.branch, form.setData]);

  const getFormField = (field: DynamicFieldConfig) => {
    if (!sourceControlEnabled && (field.name === 'source_control' || field.name === 'repository' || field.name === 'branch')) {
      return null;
    }

    if (field.name === 'source_control') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="source_control">Source Control</Label>
          <SourceControlSelect
            id="source_control"
            value={form.data.source_control}
            onValueChange={(value) => form.setData('source_control', value)}
          />
          <InputError message={form.errors.source_control} />
        </FormField>
      );
    }

    if (field.name === 'repository') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="repository">Repository</Label>
          <SelectRepo
            sourceControlId={form.data.source_control}
            value={form.data.repository}
            onValueChange={(value) => form.setData('repository', value)}
            placeholder="owner/repository"
          />
          <InputError message={form.errors.repository} />
        </FormField>
      );
    }

    if (field.name === 'branch') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="branch">Branch</Label>
          <SelectBranch
            sourceControlId={form.data.source_control}
            repository={form.data.repository}
            value={form.data.branch}
            onValueChange={(value) => form.setData('branch', value)}
            placeholder="e.g. main, master, develop"
          />
          <InputError message={form.errors.branch} />
        </FormField>
      );
    }

    if (field.name === 'php_version') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="php_version">PHP Version</Label>
          <ServiceVersionSelect
            id="php_version"
            serverId={parseInt(form.data.server)}
            service="php"
            value={form.data.php_version}
            onValueChange={(value) => form.setData('php_version', value)}
            autoSelectSingle
          />
          <InputError message={form.errors.php_version} />
        </FormField>
      );
    }

    if (field.type === 'tooling') {
      const rawOptions = field.options;
      const toolIds = Array.isArray(rawOptions) ? rawOptions : rawOptions ? Object.values(rawOptions) : [];
      const catalogue = configs.tooling ?? [];
      const showLaravelNotice = form.data.type === 'laravel' && toolIds.includes('node');

      return (
        <FormField key={`field-${field.name}`}>
          {showLaravelNotice && (
            <Alert role="status">
              <AlertDescription>Laravel sites typically need a JavaScript runtime to build front-end assets during deployment.</AlertDescription>
            </Alert>
          )}
          {field.label && <Label>{field.label}</Label>}
          <div className="flex flex-col gap-3">
            {toolIds.map((toolId) => {
              const descriptor = catalogue.find((t) => t.id === toolId);
              if (!descriptor) return null;
              const formKey = `${toolId}_version`;
              const options = ['none', ...descriptor.supported_versions];
              const labelFor = (v: string) => (v === 'none' ? 'None' : `${descriptor.label} ${v}`);
              const value = ((form.data as Record<string, unknown>)[formKey] as string | undefined) ?? 'none';

              return (
                <div key={toolId} className="space-y-2">
                  <Label htmlFor={`${toolId}-version`}>{descriptor.label}</Label>
                  <Select value={value} onValueChange={(v) => form.setData(formKey, v)}>
                    <SelectTrigger id={`${toolId}-version`}>
                      <SelectValue placeholder={`Select ${descriptor.label} version`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {options.map((v) => (
                          <SelectItem key={v} value={v}>
                            {labelFor(v)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <InputError message={(form.errors as Record<string, string | undefined>)[formKey]} />
                </div>
              );
            })}
          </div>
        </FormField>
      );
    }

    if (field.type === 'tooling-picker') {
      const rawOptions = field.options;
      const toolIds = Array.isArray(rawOptions) ? rawOptions : rawOptions ? Object.values(rawOptions) : [];
      const toolId = toolIds[0];
      const descriptor = (configs.tooling ?? []).find((t) => t.id === toolId);
      if (!toolId || !descriptor) return null;

      const formKey = `${toolId}_version`;
      const labelFor = (v: string) => `${descriptor.label} ${v}`;
      const value = ((form.data as Record<string, unknown>)[formKey] as string | undefined) ?? descriptor.supported_versions[0] ?? '';

      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor={`${toolId}-version`}>{field.label ?? `${descriptor.label} Version`}</Label>
          <Select value={value} onValueChange={(v) => form.setData(formKey, v)}>
            <SelectTrigger id={`${toolId}-version`}>
              <SelectValue placeholder={`Select ${descriptor.label} version`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {descriptor.supported_versions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {labelFor(v)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <InputError message={(form.errors as Record<string, string | undefined>)[formKey]} />
        </FormField>
      );
    }

    if (field.type === 'tooling-selector') {
      const rawOptions = field.options;
      const toolIds = Array.isArray(rawOptions) ? rawOptions : rawOptions ? Object.values(rawOptions) : [];
      const catalogue = configs.tooling ?? [];
      const pickedToolId = ((form.data as Record<string, unknown>)[field.name] as string | undefined) ?? toolIds[0] ?? '';
      const pickedDescriptor = catalogue.find((t) => t.id === pickedToolId);
      const activeToolIds = new Set(activeTools.filter((t) => t.kind === 'tooling-picker').map((t) => t.toolId));
      const versionInherited = activeToolIds.has(pickedToolId);
      const versionKey = `${pickedToolId}_version`;
      const versionValue =
        ((form.data as Record<string, unknown>)[versionKey] as string | undefined) ?? pickedDescriptor?.supported_versions[0] ?? '';
      const labelFor = (v: string) => (pickedDescriptor ? `${pickedDescriptor.label} ${v}` : v);

      return (
        <FormField key={`field-${field.name}`}>
          {field.label && <Label htmlFor={field.name}>{field.label}</Label>}
          <Select
            value={pickedToolId}
            onValueChange={(v) => {
              form.setData(field.name, v);
              if (activeToolIds.has(v)) return;
              const nextDescriptor = catalogue.find((t) => t.id === v);
              const nextVersion = nextDescriptor?.supported_versions[0] ?? '';
              if (nextVersion) form.setData(`${v}_version`, nextVersion);
            }}
          >
            <SelectTrigger id={field.name}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {toolIds.map((id) => {
                  const d = catalogue.find((t) => t.id === id);
                  return (
                    <SelectItem key={id} value={id}>
                      {field.optionLabels?.[id] ?? d?.label ?? id}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
          <InputError message={(form.errors as Record<string, string | undefined>)[field.name]} />

          {!versionInherited && pickedDescriptor && (
            <div className="mt-3 space-y-2">
              <Label htmlFor={`${pickedToolId}-selector-version`}>{pickedDescriptor.label} Version</Label>
              <Select key={pickedToolId} value={versionValue} onValueChange={(v) => form.setData(versionKey, v)}>
                <SelectTrigger id={`${pickedToolId}-selector-version`}>
                  <SelectValue placeholder={`Select ${pickedDescriptor.label} version`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {pickedDescriptor.supported_versions.map((v) => (
                      <SelectItem key={v} value={v}>
                        {labelFor(v)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={(form.errors as Record<string, string | undefined>)[versionKey]} />
            </div>
          )}
        </FormField>
      );
    }

    if (field.name === 'database') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="database">Database</Label>
          <DatabaseSelect
            id="database"
            key={`field-${field.name}`}
            name="database"
            serverId={parseInt(form.data.server)}
            value={form.data.database as string}
            onValueChange={(value) => form.setData('database', value)}
            createWithUser={true}
            defaultCharset={field.componentProps?.defaultCharset as string | undefined}
            defaultCollation={field.componentProps?.defaultCollation as string | undefined}
          />
          <InputError message={form.errors.database as string | undefined} />
        </FormField>
      );
    }

    if (field.name === 'database_user') {
      return (
        <FormField key={`field-${field.name}`}>
          <Label htmlFor="database-user">Database user</Label>
          <DatabaseUserSelect
            id="database-user"
            key={`field-${field.name}`}
            name="database_user"
            serverId={parseInt(form.data.server)}
            value={form.data.database_user as string}
            onValueChange={(value) => form.setData('database_user', value)}
            create={false}
          />
          <InputError message={form.errors.database_user as string | undefined} />
        </FormField>
      );
    }

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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="w-full lg:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Create site</SheetTitle>
          <SheetDescription>Fill in the details to create a new site.</SheetDescription>
        </SheetHeader>
        <Form id="create-site-form" className="p-4" onSubmit={submit}>
          <FormFields>
            {server === undefined && (
              <FormField>
                <Label htmlFor="server">Server</Label>
                <ServerSelect value={form.data.server} onValueChange={(value) => form.setData('server', value ? value.id.toString() : '')} />
                <InputError message={form.errors.server} />
              </FormField>
            )}

            {form.data.server && (
              <>
                <FormField>
                  <Label htmlFor="type">Site Type</Label>
                  <Select value={form.data.type} onValueChange={(value) => form.setData('type', value)}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select site type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Object.entries(configs.site.types).map(([key, type]) => (
                          <SelectItem key={`type-${key}`} value={key}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <InputError message={form.errors.type} />
                </FormField>

                <FormField>
                  <DomainPicker value={domainPickerValue} onChange={handleDomainChange} serverIp={server?.ip} error={form.errors.domain} />
                </FormField>

                {configs.site.types[form.data.type].form?.map((config) => getFormField(config))}
              </>
            )}
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button type="submit" form="create-site-form" disabled={form.processing || !form.data.server}>
              {form.processing && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
            <SheetClose asChild>
              <Button variant="outline" disabled={form.processing}>
                Cancel
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
