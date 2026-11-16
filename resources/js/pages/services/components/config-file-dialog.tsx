import { useTranslate } from '@/hooks/use-translate';
import { withQuery } from '@/lib/url';
import { ConfigPath, Service } from '@/types/service';
import { FormEvent } from 'react';
import { useForm } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Editor } from '@/components/ui/code-editor';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Form } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';

export default function ServiceConfigFileDialog({
  open,
  onOpenChange,
  service,
  configPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
  configPath: ConfigPath;
}) {
  const translateText = useTranslate();
  const form = useForm<{
    content: string;
    config_name: string;
  }>({
    content: '',
    config_name: configPath.name,
  });

    const submit = (e: FormEvent) => {
    e.preventDefault();
    form.patch(`/servers/${service.server_id}/services/${service.id}/config`, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const query = useQuery({
    queryKey: ['services.config', service.server_id, service.id, configPath.name],
    queryFn: async () => {
      const response = await axios.get(
        withQuery(`/servers/${service.server_id}/services/${service.id}/config`, { config_name: configPath.name }),
      );
      if (typeof response.data?.content === 'string') {
        form.setData('content', response.data.content);
      }
      return response.data;
    },
    retry: false,
    enabled: open,
    refetchOnWindowFocus: false,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-5xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{translateText('Edit')} {configPath.name}</SheetTitle>
          <SheetDescription className="sr-only">
            {translateText("You can edit the")} {configPath.name} {translateText("file for this service. Make sure to save your changes.")}
          </SheetDescription>
        </SheetHeader>
        <Form id="update-config-form" className="h-full" onSubmit={submit}>
          {query.isSuccess ? (
            <Editor
              defaultLanguage="ini"
              value={form.data.content}
              className="h-full"
              onChange={(value) => form.setData('content', value ?? '')}
              options={{
                fontSize: 15,
              }}
            />
          ) : (
            <Skeleton className="h-full w-full rounded-none" />
          )}
        </Form>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button form="update-config-form" type="submit" disabled={form.processing || query.isLoading} className="ml-2">
              {(form.processing || query.isLoading) && <LoaderCircleIcon className="animate-spin" />}
              {translateText('Save')}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">{translateText('Cancel')}</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
