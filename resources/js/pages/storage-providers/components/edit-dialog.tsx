import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm } from '@inertiajs/react';
import { ChevronDownIcon, LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';
import { FormEvent, useEffect, useState } from 'react';
import InputError from '@/components/ui/input-error';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { StorageProvider } from '@/types/storage-provider';
import DynamicField from '@/components/ui/dynamic-field';
import { DynamicFieldConfig, DynamicFieldValue } from '@/types/dynamic-field-config';
import { useConfigs } from '@/stores/bootstrap-store';
import { cn } from '@/lib/utils';

const OPTIONAL_FIELD_NAMES = ['path', 'port', 'ssl', 'passive'];

export default function StorageProviderEditDialog({
  open,
  onOpenChange,
  storageProvider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storageProvider: StorageProvider;
}) {
  const configs = useConfigs()!;
  const [showOptional, setShowOptional] = useState(false);

  const editFields: DynamicFieldConfig[] = configs.storage_provider.providers[storageProvider.provider]?.edit_form ?? [];

  const form = useForm<{ name: string; global: boolean } & Record<string, DynamicFieldValue>>({
    ...Object.fromEntries(editFields.map((field) => [field.name, storageProvider.editable_data?.[field.name] ?? ''])),
    name: storageProvider.name,
    global: storageProvider.global,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.patch(route('storage-providers.update', storageProvider.id), {
      onSuccess: () => onOpenChange(false),
    });
  };

  useEffect(() => {
    const hasOptionalError = Object.keys(form.errors).some((key) => OPTIONAL_FIELD_NAMES.includes(key) || key === 'global');
    if (hasOptionalError) {
      setShowOptional(true);
    }
  }, [form.errors]);

  const primaryFields = editFields.filter((f) => !OPTIONAL_FIELD_NAMES.includes(f.name));
  const optionalFields = editFields.filter((f) => OPTIONAL_FIELD_NAMES.includes(f.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Edit {storageProvider.name}</DialogTitle>
          <DialogDescription className="sr-only">Edit storage provider</DialogDescription>
        </DialogHeader>
        <Form id="edit-storage-provider-form" className="p-4 space-y-4" onSubmit={submit}>
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input type="text" id="name" name="name" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
              <InputError message={form.errors.name} />
            </FormField>

            {primaryFields.map((field) => (
              <DynamicField
                key={`field-${field.name}`}
                value={form.data[field.name]}
                onChange={(value) => form.setData(field.name, value)}
                config={field}
                error={form.errors[field.name]}
              />
            ))}

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
                  {optionalFields.map((field) => (
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
                        onCheckedChange={(checked) => form.setData('global', Boolean(checked))}
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

            <FormField>
              <InputError message={form.errors.provider} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button form="edit-storage-provider-form" type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
