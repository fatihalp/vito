import { AlertCircleIcon, ChevronDownIcon, InfoIcon, LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { router, useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, ReactNode, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DynamicFieldConfig, DynamicFieldValue } from '@/types/dynamic-field-config';
import DynamicField from '@/components/ui/dynamic-field';
import { useConfigs } from '@/stores/bootstrap-store';
import { SharedData } from '@/types';
import { cn } from '@/lib/utils';
import { requestErrorMessage } from '@/lib/request-error';

type StorageProviderForm = {
  provider: string;
  name: string;
  global: boolean;
  app_key: string;
  app_secret: string;
  [key: string]: DynamicFieldValue;
};

const S3_PRESETS = [
  {
    id: 'hetzner',
    label: 'Hetzner',
    defaultName: 'Hetzner Storage',
    apiUrl: 'https://fsn1.your-objectstorage.com',
    region: 'eu-central',
    hint: 'Endpoint: https://fsn1.your-objectstorage.com (or hel1, nbg1) | Network zone: eu-central',
  },
  {
    id: 'aws',
    label: 'AWS S3',
    defaultName: 'AWS S3 Storage',
    apiUrl: '',
    region: 'us-east-1',
    hint: 'Standard AWS S3 (API URL is left empty, Region: e.g. us-east-1, eu-west-1)',
  },
  {
    id: 'digitalocean',
    label: 'DigitalOcean',
    defaultName: 'DigitalOcean Spaces',
    apiUrl: 'https://fra1.digitaloceanspaces.com',
    region: 'fra1',
    hint: 'Endpoint: https://{region}.digitaloceanspaces.com | Region: e.g. fra1, nyc3, ams3',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare R2',
    defaultName: 'Cloudflare R2',
    apiUrl: 'https://<account_id>.r2.cloudflarestorage.com',
    region: 'auto',
    hint: 'Endpoint: https://<account_id>.r2.cloudflarestorage.com | Region: auto',
  },
  {
    id: 'custom',
    label: 'Custom S3',
    defaultName: 'S3 Storage',
    apiUrl: '',
    region: '',
    hint: '',
  },
];

const OPTIONAL_FIELD_NAMES = ['path', 'port', 'ssl', 'passive'];

export default function ConnectStorageProvider({
  defaultProvider,
  onProviderAdded,
  children,
}: {
  defaultProvider?: string;
  onProviderAdded?: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [r2Buckets, setR2Buckets] = useState<string[]>([]);
  const [selectedR2Buckets, setSelectedR2Buckets] = useState<string[]>([]);
  const [loadingR2Buckets, setLoadingR2Buckets] = useState(false);
  const [importingR2Buckets, setImportingR2Buckets] = useState(false);
  const [r2Error, setR2Error] = useState<string | null>(null);
  const bucketRequest = useRef(0);

  const configs = useConfigs()!;
  const csrfToken = usePage<SharedData>().props.csrf_token;

  const form = useForm<Required<StorageProviderForm>>({
    provider: defaultProvider || 's3',
    name: '',
    global: false,
    app_key: '',
    app_secret: '',
    api_url: '',
    key: '',
    secret: '',
    region: '',
    bucket: '',
    path: '',
  });

  const selectPreset = (preset: (typeof S3_PRESETS)[number]) => {
    setActivePreset(preset.id);
    setR2Buckets([]);
    setSelectedR2Buckets([]);
    setR2Error(null);
    form.setData((prev) => {
      const isNameEmptyOrDefault =
        prev.name === '' || S3_PRESETS.some((p) => p.defaultName === prev.name);
      return {
        ...prev,
        name: isNameEmptyOrDefault ? preset.defaultName : prev.name,
        api_url: preset.id !== 'custom' ? preset.apiUrl : prev.api_url,
        region: preset.id !== 'custom' ? preset.region : prev.region,
      };
    });
  };

  useEffect(() => {
    bucketRequest.current += 1;
    setR2Buckets([]);
    setSelectedR2Buckets([]);
    setR2Error(null);
    setLoadingR2Buckets(false);
  }, [form.data.provider, form.data.api_url, form.data.key, form.data.secret, form.data.region, form.data.path, open]);

  const listR2Buckets = async () => {
    const request = ++bucketRequest.current;
    setLoadingR2Buckets(true);
    setR2Error(null);

    try {
      const { data } = await axios.post<{ buckets: string[] }>('/settings/storage-providers/s3/buckets', {
        name: form.data.name,
        api_url: form.data.api_url,
        key: form.data.key,
        secret: form.data.secret,
        region: form.data.region,
        path: form.data.path,
      });
      if (request !== bucketRequest.current) return;
      setR2Buckets(data.buckets);
      setSelectedR2Buckets(data.buckets);
    } catch (error) {
      if (request === bucketRequest.current) setR2Error(requestErrorMessage(error));
    } finally {
      if (request === bucketRequest.current) setLoadingR2Buckets(false);
    }
  };

  const importR2Buckets = async () => {
    setImportingR2Buckets(true);
    setR2Error(null);

    try {
      await axios.post('/settings/storage-providers/s3/buckets/import', {
        name: form.data.name,
        global: form.data.global,
        api_url: form.data.api_url,
        key: form.data.key,
        secret: form.data.secret,
        region: form.data.region,
        path: form.data.path,
        buckets: selectedR2Buckets,
      });
      setOpen(false);
      onProviderAdded?.();
      router.reload({ only: ['storageProviders'] });
    } catch (error) {
      setR2Error(requestErrorMessage(error));
    } finally {
      setImportingR2Buckets(false);
    }
  };

  const submit: FormEventHandler = (e) => {
    e.preventDefault();

    if (form.data.provider === 'dropbox') {
      redirectToDropbox();
      return;
    }

    form.post("/settings/storage-providers", {
      onSuccess: () => {
        setOpen(false);
        if (onProviderAdded) {
          onProviderAdded();
        }
      },
    });
  };

  const redirectToDropbox = () => {
    let hasError = false;
    if (!form.data.name) {
      form.setError('name', 'The name field is required.');
      hasError = true;
    }
    if (!form.data.app_key) {
      form.setError('app_key', 'The app key field is required.');
      hasError = true;
    }
    if (!form.data.app_secret) {
      form.setError('app_secret', 'The app secret field is required.');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    const values: Record<string, string> = {
      _token: csrfToken,
      name: form.data.name,
      app_key: form.data.app_key,
      app_secret: form.data.app_secret,
      global: form.data.global ? '1' : '',
    };

    const nativeForm = document.createElement('form');
    nativeForm.method = 'POST';
    nativeForm.action = "/settings/storage-providers/dropbox/redirect";
    nativeForm.style.display = 'none';

    Object.entries(values).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value ?? '';
      nativeForm.appendChild(input);
    });

    document.body.appendChild(nativeForm);
    nativeForm.submit();
  };

  useEffect(() => {
    const providerConfig = configs.storage_provider.providers[form.data.provider];
    if (providerConfig?.form) {
      providerConfig.form.forEach((field: DynamicFieldConfig) => {
        if (field.default !== undefined && (form.data[field.name] === '' || form.data[field.name] === undefined)) {
          form.setData(field.name, field.default);
        }
      });
    }
  }, [form.data.provider, configs]);

  useEffect(() => {
    const hasOptionalError = Object.keys(form.errors).some((key) => OPTIONAL_FIELD_NAMES.includes(key) || key === 'global');
    if (hasOptionalError) {
      setShowOptional(true);
    }
  }, [form.errors]);

  const rawFields: DynamicFieldConfig[] = configs.storage_provider.providers[form.data.provider]?.form ?? [];
  const primaryFields = rawFields.filter((f) => !OPTIONAL_FIELD_NAMES.includes(f.name));
  const optionalFields = rawFields.filter((f) => OPTIONAL_FIELD_NAMES.includes(f.name));

  const currentPresetObj = S3_PRESETS.find((p) => p.id === activePreset);
  const isCloudflareR2 = form.data.provider === 's3' && activePreset === 'cloudflare';
  const providerError = form.errors.provider || r2Error;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect to storage provider</DialogTitle>
          <DialogDescription className="sr-only">Connect to a new storage provider</DialogDescription>
        </DialogHeader>
        <Form
          id="create-storage-provider-form"
          onSubmit={submit}
          className="p-4 space-y-4"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
        >
          <FormFields>
            {providerError && (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertTitle>Connection failed</AlertTitle>
                <AlertDescription>{providerError}</AlertDescription>
              </Alert>
            )}
            <FormField>
              <Label htmlFor="provider">Provider</Label>
              <Select
                value={form.data.provider}
                onValueChange={(value) => {
                  form.setData('provider', value);
                  form.clearErrors();
                  setActivePreset(null);
                }}
              >
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(configs.storage_provider.providers).map(([key, provider]) => (
                      <SelectItem key={key} value={key}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.provider} />
            </FormField>

            {form.data.provider === 's3' && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">S3 Service Preset</Label>
                  <span className="text-[11px] text-muted-foreground">Click to auto-fill endpoint &amp; region</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {S3_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant={activePreset === p.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-2.5"
                      onClick={() => selectPreset(p)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {currentPresetObj?.hint && (
                  <p className="text-[11px] text-muted-foreground font-mono bg-background/80 rounded px-2 py-1 border">
                    {currentPresetObj.hint}
                  </p>
                )}
              </div>
            )}

            {form.data.provider === 'dropbox' && (
              <Alert>
                <InfoIcon className="size-4" />
                <AlertTitle>Connect with Dropbox OAuth</AlertTitle>
                <AlertDescription>
                  <p>Create a Dropbox app with offline access enabled, then add this redirect URI to its OAuth settings:</p>
                  <code className="bg-muted block w-full rounded px-1.5 py-1 text-xs break-all mt-1">
                    {"/settings/storage-providers/dropbox/callback"}
                  </code>
                  <p className="mt-1">Enter the app key and secret below, then continue to Dropbox to authorize access.</p>
                </AlertDescription>
              </Alert>
            )}

            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input
                type="text"
                name="name"
                id="name"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                data-form-type="other"
                spellCheck={false}
                placeholder="e.g. Hetzner Storage or Backups"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
              />
              <InputError message={form.errors.name} />
            </FormField>

            {primaryFields.map((field: DynamicFieldConfig) => (
              <DynamicField
                key={`field-${field.name}`}
                value={form.data[field.name]}
                onChange={(value) => form.setData(field.name, value)}
                config={field}
                error={form.errors[field.name]}
              />
            ))}

            {isCloudflareR2 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div>
                  <Label className="text-sm font-semibold">R2 account buckets</Label>
                  <p className="mt-1 text-xs text-muted-foreground">List your account once, then import selected buckets as manageable Vito storage providers.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={loadingR2Buckets || !form.data.name || !form.data.key || !form.data.secret || !form.data.region}
                  onClick={() => void listR2Buckets()}
                >
                  {loadingR2Buckets && <LoaderCircle className="animate-spin" />}
                  List R2 buckets
                </Button>

                {r2Buckets.length > 0 && (
                  <div className="space-y-2 rounded-md border bg-background p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">{r2Buckets.length} bucket found</span>
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => setSelectedR2Buckets(selectedR2Buckets.length === r2Buckets.length ? [] : r2Buckets)}
                      >
                        {selectedR2Buckets.length === r2Buckets.length ? 'Clear selection' : 'Select all'}
                      </button>
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto">
                      {r2Buckets.map((bucket) => (
                        <label key={bucket} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedR2Buckets.includes(bucket)}
                            onCheckedChange={(checked) => {
                              setSelectedR2Buckets((selected) => checked ? [...selected, bucket] : selected.filter((item) => item !== bucket));
                            }}
                          />
                          <span className="font-mono text-xs">{bucket}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      disabled={importingR2Buckets || selectedR2Buckets.length === 0}
                      onClick={() => void importR2Buckets()}
                    >
                      {importingR2Buckets && <LoaderCircle className="animate-spin" />}
                      Import selected buckets to Vito
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium py-1.5 transition-colors cursor-pointer"
              >
                <ChevronDownIcon className={cn('size-3.5 transition-transform duration-200', showOptional && 'rotate-180')} />
                <span>{showOptional ? 'Hide optional fields' : 'Show optional fields (Path, Global)'}</span>
              </button>

              {showOptional && (
                <div className="mt-2 space-y-4 rounded-md border bg-muted/20 p-3 animate-in fade-in-50 duration-200">
                  {optionalFields.map((field: DynamicFieldConfig) => (
                    <DynamicField
                      key={`field-${field.name}`}
                      value={form.data[field.name]}
                      onChange={(value) => form.setData(field.name, value)}
                      config={field}
                      error={form.errors[field.name]}
                    />
                  ))}
                  <FormField>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="global"
                        name="global"
                        checked={form.data.global}
                        onClick={() => form.setData('global', !form.data.global)}
                      />
                      <Label htmlFor="global" className="text-xs font-normal">
                        Is global (accessible in all projects)
                      </Label>
                    </div>
                    <InputError message={form.errors.global} />
                  </FormField>
                </div>
              )}
            </div>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={form.processing}>
            {form.processing && <LoaderCircle className="animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
