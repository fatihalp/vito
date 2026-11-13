import { useTranslate } from '@/hooks/use-translate';
import { Service } from '@/types/service';
import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';
import { useConfigs } from '@/stores/bootstrap-store';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';

export default function PhpExtensionsDialog({
  open,
  onOpenChange,
  service,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}) {
  const translateText = useTranslate();
  const configs = useConfigs()!;
  const form = useForm<{
    extension: string;
    version: string;
  }>({
    extension: '',
    version: service.version,
  });
  const [, php] = Object.entries(configs.service.services).filter(([key]) => key === 'php')[0] ?? [];
  const query = useQuery({
    queryKey: ['php.extensions', service.server_id, service.id],
    queryFn: async () => {
      const response = await axios.get<{ extensions: string[] }>(`/servers/${service.server_id}/php/${service.id}/extensions`);
      return response.data.extensions;
    },
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const installedExtensions = query.data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(`/servers/${service.server_id}/php/${service.id}/install-extension`, {
      onSuccess: () => onOpenChange(false),
    });
  };

  if (!php) {
    return null;
  }

  const availableExtensions = Array.isArray(service.type_data?.available_extensions)
    ? service.type_data.available_extensions
    : Array.isArray(php.data?.extensions)
      ? php.data.extensions
      : Object.values(service.type_data?.available_extensions || php.data?.extensions || {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{translateText("Install extension")}</DialogTitle>
          <DialogDescription className="sr-only">{translateText("Install php extension")}</DialogDescription>
        </DialogHeader>
        <Form id="install-extension-form" className="p-4" onSubmit={submit}>
          <FormFields>
            <FormField>
              <Label>{translateText("Installed extensions")}</Label>
              {query.isPending ? (
                <p role="status" className="text-sm text-muted-foreground">{translateText("Loading installed extensions…")}</p>
              ) : query.isError ? (
                <div role="alert" className="flex items-center gap-2">
                  <p className="text-sm text-destructive">{translateText("Could not load installed extensions.")}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
                    {translateText('Retry')}
                  </Button>
                </div>
              ) : (
                <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {installedExtensions.map((extension) => <Badge key={extension} variant="secondary">{extension}</Badge>)}
                </div>
              )}
            </FormField>
            <FormField>
              <Label htmlFor="extension">{translateText("Extension")}</Label>
              <Select value={form.data.extension} onValueChange={(value) => form.setData('extension', value)} disabled={!query.isSuccess}>
                <SelectTrigger id="extension">
                  <SelectValue placeholder={translateText("Select an extension")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableExtensions.map((extension: string) => (
                      <SelectItem key={`extension-${extension}`} value={extension} disabled={installedExtensions.includes(extension) || service.type_data?.extensions?.includes(extension)}>
                        {extension} {installedExtensions.includes(extension) && <span>{translateText("(installed)")}</span>}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={form.errors.extension} />
            </FormField>
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{translateText('Cancel')}</Button>
          </DialogClose>
          <Button form="install-extension-form" type="submit" disabled={form.processing || !query.isSuccess || !form.data.extension || installedExtensions.includes(form.data.extension)} className="ml-2">
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            {translateText('Install')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
