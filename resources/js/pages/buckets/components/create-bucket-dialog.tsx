import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import { FormEvent, useEffect } from 'react';

export default function CreateBucketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const configs = useConfigs()!;

    const form = useForm<{
    name: string;
    region: string;
    visibility: 'private' | 'public';
    allowed_origins: string;
  }>({
    name: '',
    region: configs.bucket.regions[0]?.value ?? '',
    visibility: 'private',
    allowed_origins: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.transform((data) => ({
      ...data,
      allowed_origins: data.allowed_origins
        .split('\n')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    }));
    form.post(route('buckets.store'), {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>New bucket</SheetTitle>
          <SheetDescription className="sr-only">Create a new Hetzner Object Storage bucket</SheetDescription>
        </SheetHeader>
        <Form id="create-bucket-form" onSubmit={submit} className="p-4">
          <FormFields>
            <FormField>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoComplete="off"
                className="font-mono"
                placeholder="my-app-uploads"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
              />
              <div className="text-muted-foreground text-sm">
                Lowercase letters, numbers and hyphens only. Bucket names are globally unique across all Hetzner customers.
              </div>
              <InputError message={form.errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="region">Region</Label>
              <Select value={form.data.region} onValueChange={(value) => form.setData('region', value)}>
                <SelectTrigger id="region" className="w-full">
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {configs.bucket.regions.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.region} />
            </FormField>

            <FormField>
              <Label>Visibility</Label>
              <RadioGroup value={form.data.visibility} onValueChange={(value) => form.setData('visibility', value as 'private' | 'public')}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="private" id="visibility-private" className="mt-1" />
                  <div className="grid gap-0.5">
                    <Label htmlFor="visibility-private">Private</Label>
                    <span className="text-muted-foreground text-sm">Requires credentials for all access.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="public" id="visibility-public" className="mt-1" />
                  <div className="grid gap-0.5">
                    <Label htmlFor="visibility-public">Public</Label>
                    <span className="text-muted-foreground text-sm">Allows read access without credentials.</span>
                  </div>
                </div>
              </RadioGroup>
              <InputError message={form.errors.visibility} />
            </FormField>

            <FormField>
              <Label htmlFor="allowed_origins">Allowed origins</Label>
              <Textarea
                id="allowed_origins"
                placeholder="https://example.com"
                rows={3}
                value={form.data.allowed_origins}
                onChange={(e) => form.setData('allowed_origins', e.target.value)}
              />
              <div className="text-muted-foreground text-sm">One origin per line, including the protocol. Leave empty to allow none.</div>
              <InputError message={form.errors.allowed_origins} />
            </FormField>
          </FormFields>
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button form="create-bucket-form" type="submit" disabled={form.processing}>
              {form.processing && <LoaderCircleIcon className="animate-spin" />}
              Create
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
