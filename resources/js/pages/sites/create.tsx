import { useState, FormEventHandler, useEffect, useMemo } from 'react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  Layers3Icon,
  LoaderCircleIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import Layout from '@/layouts/app/layout';
import ServerLayout from '@/layouts/server/layout';
import Container from '@/components/container';
import { SharedData } from '@/types';

type SiteCreationDefaults = {
  php_version: string | null;
  source_control_id: number | null;
};

type VitoConfigData = {
  name?: string | null;
  type?: string;
  php_version?: string | null;
  node_version?: string | null;
  web_directory?: string;
  package_manager?: string;
  commands?: string[];
  crons?: Array<{ name?: string; command: string; frequency?: string }>;
  workers?: Array<{ name: string; command: string; numprocs?: number }>;
  environment?: Record<string, string> | string | null;
  database?: any;
  limits?: {
    client_max_body_size?: string | number;
    upload_max_filesize?: string | number;
    post_max_size?: string | number;
    memory_limit?: string | number;
    max_execution_time?: string | number;
  };
};

type VitoDetectionResult = {
  exists: boolean;
  path?: string | null;
  config?: VitoConfigData | null;
  error?: string | null;
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
  vito_config?: VitoConfigData;
  [key: string]: string | number | boolean | string[] | VitoConfigData | undefined;
};

export default function CreateSitePage({
  server: propServer,
}: {
  server?: Server;
}) {
  const page = usePage<SharedData & { server?: Server }>();
  const server = propServer || page.props.server;
  const isServerContext = Boolean(server && !server.is_self);
  const PageLayout = isServerContext ? ServerLayout : Layout;

  const configs = useConfigs()!;
  const [step, setStep] = useState<1 | 2>(1);

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

  const isVitoType = form.data.type === 'vito';
  const [vitoScanning, setVitoScanning] = useState(false);
  const [vitoDetected, setVitoDetected] = useState<VitoDetectionResult | null>(null);

  useEffect(() => {
    if (!isVitoType || !form.data.source_control || !form.data.repository) {
      setVitoDetected(null);
      return;
    }

    let isMounted = true;
    setVitoScanning(true);

    axios
      .get<VitoDetectionResult>(
        route('source-controls.vito-config', {
          source_control: form.data.source_control,
          repo: form.data.repository,
        }),
        {
          params: { branch: form.data.branch || 'main' },
        },
      )
      .then(({ data }) => {
        if (!isMounted) return;
        setVitoDetected(data);
        if (data.exists && data.config) {
          const cfg = data.config;
          form.setData((prev) => ({
            ...prev,
            vito_config: cfg,
            php_version: cfg.php_version || prev.php_version,
            web_directory: cfg.web_directory || 'public',
            package_manager: cfg.package_manager || 'composer',
          }));
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message =
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : 'Failed to inspect repository for vito.json.';
        setVitoDetected({
          exists: false,
          error: message,
        });
      })
      .finally(() => {
        if (isMounted) {
          setVitoScanning(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isVitoType, form.data.source_control, form.data.repository, form.data.branch]);

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

  const backRoute = isServerContext
    ? route('sites', { server: server!.id })
    : route('sites.all');

  return (
    <PageLayout>
      <Head title="Create site" />

      <Container className="max-w-3xl py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild className="h-7 px-2 -ml-2 text-muted-foreground hover:text-foreground">
              <Link href={backRoute}>
                <ArrowLeftIcon className="mr-1 size-3.5" />
                Back to sites
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create a new site</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {step === 1
              ? 'Select the type of site you want to create. Each type has different configurations and features.'
              : 'Configure repository, runtime, and domain settings for your new site.'}
          </p>
        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
          {step === 1 && (
            <div>
              {!server && (
                <div className="p-6 pb-2 border-b bg-muted/20">
                  <FormField>
                    <Label htmlFor="server">Target Server</Label>
                    <ServerSelect
                      value={form.data.server}
                      excludeSelf
                      onValueChange={(val) => form.setData('server', val ? val.id.toString() : '')}
                    />
                    <InputError message={form.errors.server} />
                  </FormField>
                </div>
              )}

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(configs.site.types).map(([type, config]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectSiteType(type)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border bg-background hover:bg-muted/50 hover:border-primary/50 transition-all text-left group cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="size-10 rounded-lg bg-muted/40 flex items-center justify-center shrink-0 p-1">
                          {getSiteTypeIcon(type, 32)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                              {config.label}
                            </span>
                            {type === 'vito' && (
                              <Badge variant="outline" className="text-[10px] py-0 bg-primary/10 text-primary border-primary/30">
                                Auto-Detect
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRightIcon className="size-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t bg-muted/20 flex items-center justify-between">
                <Button variant="outline" asChild>
                  <Link href={backRoute}>Cancel</Link>
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="border-b bg-muted/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 flex items-center justify-center shrink-0 rounded-xl bg-background border p-1">
                    {getSiteTypeIcon(form.data.type, 32)}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {isVitoType ? 'Install with Vito Config' : `Install a ${selectedTypeLabel} application`}
                    </h2>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  <span>Change type</span>
                </Button>
              </div>

              <Form id="create-site-form" className="p-6 sm:p-8 space-y-6" onSubmit={submit}>
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

                  {isVitoType ? (
                    <>
                      {server === undefined && (
                        <FormField>
                          <Label htmlFor="server">Server</Label>
                          <ServerSelect
                            value={form.data.server}
                            excludeSelf
                            onValueChange={(value) => form.setData('server', value ? value.id.toString() : '')}
                          />
                          <InputError message={form.errors.server} />
                        </FormField>
                      )}

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
                          />
                          <InputError message={form.errors.branch} />
                        </FormField>
                      </div>

                      {vitoScanning && (
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                          <LoaderCircleIcon className="size-4 animate-spin text-primary shrink-0" />
                          <span>Scanning repository for vito.json configuration...</span>
                        </div>
                      )}

                      {!vitoScanning && form.data.repository && vitoDetected && !vitoDetected.exists && (
                        <Alert variant="destructive">
                          <TriangleAlertIcon className="size-4" />
                          <AlertTitle>vito.json not found</AlertTitle>
                          <AlertDescription>
                            {vitoDetected.error || `Could not find vito.json or .vito.json in ${form.data.repository} (${form.data.branch || 'main'}). Please verify that the file exists in the repository root.`}
                          </AlertDescription>
                        </Alert>
                      )}

                      {!vitoScanning && vitoDetected?.exists && vitoDetected.config && (
                        <>
                          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2Icon className="size-4 text-emerald-500" />
                                <span className="text-xs font-semibold text-foreground">
                                  vito.json recognized ({vitoDetected.path})
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[11px] uppercase font-mono">
                                {vitoDetected.config.type || 'laravel'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              {vitoDetected.config.php_version && (
                                <div className="bg-background/80 rounded p-2 border">
                                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">PHP</div>
                                  <div className="font-mono text-foreground">{vitoDetected.config.php_version}</div>
                                </div>
                              )}
                              <div className="bg-background/80 rounded p-2 border">
                                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Web Dir</div>
                                <div className="font-mono text-foreground">{vitoDetected.config.web_directory || 'public'}</div>
                              </div>
                              <div className="bg-background/80 rounded p-2 border">
                                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Commands</div>
                                <div className="font-mono text-foreground">{vitoDetected.config.commands?.length ?? 0} step(s)</div>
                              </div>
                              <div className="bg-background/80 rounded p-2 border">
                                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Crons / Workers</div>
                                <div className="font-mono text-foreground">
                                  {(vitoDetected.config.crons?.length ?? 0) + (vitoDetected.config.workers?.length ?? 0)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <FormField>
                            <DomainPicker
                              value={domainPickerValue}
                              onChange={handleDomainChange}
                              serverIp={server?.ip}
                              error={form.errors.domain}
                            />
                          </FormField>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {server === undefined && (
                        <FormField>
                          <Label htmlFor="server">Server</Label>
                          <ServerSelect
                            value={form.data.server}
                            excludeSelf
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
                            />
                            <InputError message={form.errors.branch} />
                          </FormField>
                        </div>
                      )}

                      {isPhpType && (
                        <FormField>
                          <Label htmlFor="php_version">PHP version</Label>
                          <ServiceVersionSelect
                            id="php_version"
                            service="php"
                            value={form.data.php_version}
                            onValueChange={(value) => form.setData('php_version', value)}
                            serverId={parseInt(form.data.server || server?.id?.toString() || '0')}
                          />
                          <InputError message={form.errors.php_version} />
                        </FormField>
                      )}

                      {primaryFields.map(getFormField)}

                      {advancedFields.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer py-1"
                          >
                            <ChevronRightIcon
                              className={cn('size-3.5 transition-transform duration-200', showAdvanced && 'rotate-90')}
                            />
                            <span>Advanced Settings</span>
                            {hasAdvancedErrors && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                Error
                              </Badge>
                            )}
                          </button>

                          {showAdvanced && (
                            <div className="mt-3 space-y-4 rounded-xl border border-dashed border-border/80 bg-muted/10 p-4">
                              {advancedFields.map(getFormField)}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </FormFields>

                <div className="pt-4 border-t flex items-center justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={form.processing}>
                    <ArrowLeftIcon className="mr-1.5 size-4" /> Back
                  </Button>

                  <Button type="submit" disabled={form.processing}>
                    {form.processing && <LoaderCircleIcon className="mr-1.5 size-4 animate-spin" />}
                    Create site
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </div>
      </Container>
    </PageLayout>
  );
}
