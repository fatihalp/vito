import { ReactNode, useState, FormEventHandler, useEffect, useMemo } from 'react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import axios from 'axios';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import SourceControlSelect from '@/pages/source-controls/components/source-control-select';
import { Server } from '@/types/server';
import ServerSelect from '@/pages/servers/components/server-select';
import ServiceVersionSelect from '@/pages/services/components/service-version-select';
import { DynamicFieldConfig } from '@/types/dynamic-field-config';
import DynamicField from '@/components/ui/dynamic-field';
import SelectRepo from '@/pages/source-controls/components/select-repo';
import SelectBranch from '@/pages/source-controls/components/select-branch';
import DomainPicker, { DomainPickerValue, emptyDomainPickerValue } from '@/pages/sites/components/domain-picker';
import { getSiteTypeIcon } from '@/components/icons/framework-icons';
import { cn } from '@/lib/utils';

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
  const [step, setStep] = useState<1 | 2>(1);

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

  const selectSiteType = (type: string) => {
    form.setData('type', type);
    setStep(2);
  };

  const currentTypeForm = configs.site.types[form.data.type]?.form ?? [];
  const isPhpType = currentTypeForm.some((f) => f.name === 'php_version');
  const usesSourceControlToggle = currentTypeForm.some((f) => f.name === 'use_source_control');
  const supportsSourceControl =
    currentTypeForm.some((f) => f.name === 'source_control' || f.name === 'repository') &&
    (!usesSourceControlToggle || Boolean(form.data.use_source_control));
  const inheritedVersionTools = useMemo(
    () => currentTypeForm.filter((f) => f.type === 'tooling-picker').flatMap((f) => (Array.isArray(f.options) ? f.options : [])),
    [currentTypeForm],
  );

  const isAdvancedField = (field: DynamicFieldConfig) => {
    if (field.name === 'web_directory' || field.name === 'package_manager') {
      return true;
    }
    return isPhpType && (field.type === 'tooling' || field.type === 'tooling-selector');
  };

  const primaryFields = useMemo(
    () =>
      currentTypeForm.filter(
        (f) =>
          !isAdvancedField(f) &&
          !['source_control', 'repository', 'branch', 'php_version'].includes(f.name),
      ),
    [currentTypeForm, isPhpType],
  );
  const advancedFields = useMemo(() => currentTypeForm.filter((f) => isAdvancedField(f)), [currentTypeForm, isPhpType]);

  const renderedErrorKeys = useMemo(() => {
    const keys = new Set<string>([
      'server',
      'domain',
      'dns_provider_id',
      'provider_domain_id',
      'create_dns_record',
      'dns_record_proxied',
      ...(supportsSourceControl ? ['source_control', 'repository', 'branch'] : []),
      ...(isPhpType ? ['php_version'] : []),
      ...currentTypeForm.map((f) => f.name),
    ]);
    currentTypeForm
      .filter((f) => f.type === 'tooling-picker' || f.type === 'tooling-selector')
      .flatMap((f) => (Array.isArray(f.options) ? f.options : []))
      .forEach((toolId) => keys.add(`${toolId}_version`));
    return keys;
  }, [currentTypeForm, supportsSourceControl, isPhpType]);

  const generalErrors = Object.entries(form.errors as Record<string, string | undefined>).filter(
    ([key, message]) => Boolean(message) && !renderedErrorKeys.has(key),
  );

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

  const selectedTypeLabel = configs.site.types[form.data.type]?.label || form.data.type;

  const getFormField = (field: DynamicFieldConfig) => {
    return (
      <DynamicField
        key={`field-${field.name}`}
        value={form.data[field.name] as string | number | boolean | string[] | undefined}
        onChange={(value) => form.setData(field.name, value)}
        config={field}
        error={(form.errors as Record<string, string | undefined>)[field.name]}
        form={form}
        inheritedVersionTools={inheritedVersionTools}
      />
    );
  };

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

            <div className="flex-1 overflow-y-auto p-6">
              <div className="divide-y divide-border/40 rounded-xl border bg-card overflow-hidden">
                {Object.entries(configs.site.types).map(([type, config]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => selectSiteType(type)}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-muted/50 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="size-8 flex items-center justify-center shrink-0">{getSiteTypeIcon(type, 28)}</div>
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{config.label}</span>
                    </div>
                    <ChevronRightIcon className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t bg-muted/20 flex flex-row items-center justify-end gap-3 mt-auto">
              <SheetClose asChild>
                <Button type="button" variant="outline" className="h-10 px-5 text-sm font-medium cursor-pointer">
                  Cancel
                </Button>
              </SheetClose>
            </div>
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

              <div className="flex items-center gap-3.5">
                <div className="size-10 flex items-center justify-center shrink-0 rounded-lg bg-muted/30 p-1">
                  {getSiteTypeIcon(form.data.type, 36)}
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold tracking-tight">Install a {selectedTypeLabel} application</SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    Configure repository, runtime, and domain settings
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <Form id="create-site-form" className="p-6 flex-1 overflow-y-auto space-y-5" onSubmit={submit}>
              <FormFields className="space-y-4">
                {generalErrors.length > 0 && (
                  <Alert variant="destructive">
                    <TriangleAlertIcon />
                    <AlertTitle>Site could not be created</AlertTitle>
                    <AlertDescription>
                      {generalErrors.map(([key, message]) => (
                        <p key={key}>{message}</p>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

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
                          serverId={form.data.server ? parseInt(form.data.server) : server?.id}
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

            <div className="p-4 sm:p-5 border-t bg-muted/20 flex flex-row items-center justify-between gap-4 mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={form.processing}
                className="h-10 px-4 gap-2 text-sm font-medium cursor-pointer"
              >
                <ArrowLeftIcon className="size-4" />
                <span>Back</span>
              </Button>

              <div className="flex items-center gap-3">
                <SheetClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={form.processing}
                    className="h-10 px-4 text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </SheetClose>
                <Button
                  type="submit"
                  form="create-site-form"
                  disabled={form.processing || (!server && !form.data.server)}
                  className="h-10 px-6 text-sm font-semibold cursor-pointer shadow-sm"
                >
                  {form.processing && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
                  <span>Create site</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
