import { InputHTMLAttributes, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicFieldConfig, DynamicFieldValue } from '@/types/dynamic-field-config';
import InputError from '@/components/ui/input-error';
import { FormField } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlertIcon } from 'lucide-react';
import ServerProviderSelect from '@/pages/server-providers/components/server-provider-select';
import { useConfigs } from '@/stores/bootstrap-store';

type ToolingFormBridge = {
  data: Record<string, unknown>;
  errors: Partial<Record<string, string>>;
  setData: (key: string, value: DynamicFieldValue) => void;
};

interface DynamicFieldProps {
  value: string | number | boolean | string[] | undefined;
  onChange: (value: string | number | boolean | string[]) => void;
  config: DynamicFieldConfig;
  error?: string;
  form?: ToolingFormBridge;
  inheritedVersionTools?: string[];
}

const toolIdsOf = (config: DynamicFieldConfig): string[] =>
  Array.isArray(config.options) ? config.options : config.options ? Object.values(config.options) : [];

export default function DynamicField({ value, onChange, config, error, form, inheritedVersionTools = [] }: DynamicFieldProps) {
  const defaultLabel = config.name.replaceAll('_', ' ');
  const label = config?.label || defaultLabel;
  const [initialValue, setInitialValue] = useState(false);
  const catalogue = useConfigs()?.tooling ?? [];

  if (value === undefined || value === null) {
    value = config?.default ?? '';
  }

  useEffect(() => {
    if (!initialValue) {
      if (config.type === 'checkbox') {
        onChange((value as boolean) || false);
      } else {
        onChange(value);
      }
      setInitialValue(true);
    }
  }, [initialValue, setInitialValue, onChange, value, config]);

  
  if (config?.type === 'alert') {
    return (
      <FormField>
        <Alert>
          {!Array.isArray(config.options) && config.options?.type === 'warning' && <TriangleAlertIcon className="text-warning!" />}
          {config.label && <AlertTitle>{config.label}</AlertTitle>}
          <AlertDescription className="whitespace-pre-line">
            {config.description}
            {config.link && (
              <span className="block mt-2">
                <a href={config.link.url} target="_blank" rel="noreferrer" className="text-primary font-medium underline inline-flex items-center gap-1">
                  {config.link.label} &rarr;
                </a>
              </span>
            )}
          </AlertDescription>
        </Alert>
      </FormField>
    );
  }

  
  if (config?.type === 'checkbox') {
    return (
      <FormField>
        <div className="flex items-center space-x-2">
          <Switch id={`switch-${config.name}`} defaultChecked={value as boolean} onCheckedChange={onChange} />
          <Label htmlFor={`switch-${config.name}`}>{label}</Label>
          {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
          <InputError message={error} />
        </div>
      </FormField>
    );
  }

  
  if (config?.type === 'select' && config.options) {
    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`} className="capitalize">
          {label}
        </Label>
        <Select defaultValue={value as string} onValueChange={onChange}>
          <SelectTrigger id={`field-${config.name}`}>
            <SelectValue placeholder={config.placeholder || `Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Array.isArray(config.options) &&
                config.options.map((item) => (
                  <SelectItem key={`${config.name}-${item}`} value={item}>
                    {item}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  
  if (config?.type === 'textarea') {
    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`} className="capitalize">
          {label}
        </Label>
        <Textarea
          name={config.name}
          id={`field-${config.name}`}
          defaultValue={(value as string) || ''}
          placeholder={config.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={config.className}
        />
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  
  if (config?.type === 'password') {
    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`} className="capitalize">
          {label}
        </Label>
        <Input
          type="password"
          name={config.name}
          id={`field-${config.name}`}
          defaultValue={(value as string) || ''}
          placeholder={config.placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          spellCheck={false}
        />
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  if (config?.type === 'password-with-toggle') {
    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`} className="capitalize">
          {label}
        </Label>
        <PasswordInput
          name={config.name}
          id={`field-${config.name}`}
          defaultValue={(value as string) || ''}
          placeholder={config.placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
          data-form-type="other"
          spellCheck={false}
        />
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  if (config?.type === 'tooling-picker') {
    const descriptor = catalogue.find((t) => t.id === toolIdsOf(config)[0]);
    const versions = descriptor?.supported_versions ?? [];

    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`}>{label}</Label>
        <Select value={(value as string) || versions[0] || ''} onValueChange={onChange}>
          <SelectTrigger id={`field-${config.name}`}>
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {versions.map((v) => (
                <SelectItem key={`${config.name}-${v}`} value={v}>
                  {descriptor?.label} {v}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  if (config?.type === 'tooling-selector') {
    const ids = toolIdsOf(config);
    const picked = (value as string) || ids[0] || '';
    const descriptor = catalogue.find((t) => t.id === picked);
    const versionKey = `${picked}_version`;
    const showVersion = form !== undefined && descriptor !== undefined && !inheritedVersionTools.includes(picked);
    const versionValue = (form?.data[versionKey] as string | undefined) || descriptor?.supported_versions[0] || '';

    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`}>{label}</Label>
        <Select
          value={picked}
          onValueChange={(v) => {
            onChange(v);
            const next = catalogue.find((t) => t.id === v);
            if (form && next && !inheritedVersionTools.includes(v) && !form.data[`${v}_version`]) {
              form.setData(`${v}_version`, next.supported_versions[0] ?? '');
            }
          }}
        >
          <SelectTrigger id={`field-${config.name}`}>
            <SelectValue placeholder={`Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ids.map((id) => (
                <SelectItem key={`${config.name}-${id}`} value={id}>
                  {config.optionLabels?.[id] ?? catalogue.find((t) => t.id === id)?.label ?? id}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
        {showVersion && (
          <div className="flex flex-col gap-2 pt-2">
            <Label htmlFor={`field-${versionKey}`}>{descriptor.label} Version</Label>
            <Select value={versionValue} onValueChange={(v) => form.setData(versionKey, v)}>
              <SelectTrigger id={`field-${versionKey}`}>
                <SelectValue placeholder={`Select ${descriptor.label} version`} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {descriptor.supported_versions.map((v) => (
                    <SelectItem key={`${versionKey}-${v}`} value={v}>
                      {descriptor.label} {v}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <InputError message={form.errors[versionKey]} />
          </div>
        )}
      </FormField>
    );
  }

  if (config?.type === 'component' && config?.name === 'server_provider') {
    return (
      <FormField>
        <Label htmlFor={`field-${config.name}`} className="capitalize">
          {label}
        </Label>
        <ServerProviderSelect value={value as string} onValueChange={(value) => onChange(value)} />
        {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
        <InputError message={error} />
      </FormField>
    );
  }

  const props: InputHTMLAttributes<HTMLInputElement> = {};
  if (config?.placeholder) {
    props.placeholder = config.placeholder;
  }

  return (
    <FormField>
      <Label htmlFor={`field-${config.name}`} className="capitalize">
        {label}
      </Label>
      <Input
        type="text"
        name={config.name}
        id={`field-${config.name}`}
        defaultValue={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        spellCheck={false}
        {...props}
      />
      {config.description && <p className="text-muted-foreground text-xs">{config.description}</p>}
      <InputError message={error} />
    </FormField>
  );
}
