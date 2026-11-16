import SettingsLayout from '@/layouts/settings/layout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { LoaderCircleIcon, UploadCloudIcon } from 'lucide-react';
import Container from '@/components/container';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardRow } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InputError from '@/components/ui/input-error';

type Page = {
  storageProviders: { id: number; profile: string }[];
};

export default function VitoSettings() {
  const { storageProviders } = usePage<Page>().props;
  const form = useForm({ storage_provider_id: '' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post('/admin/vito/backup');
  };

  return (
    <SettingsLayout>
      <Head title="Pure Settings" />

      <Container>
        <Heading title="Pure Settings" description="Back up the Pure database to an S3 storage provider" />

        <Card>
          <CardContent>
            <CardRow>
              <form onSubmit={submit} className="flex w-full items-center gap-2">
                <Select value={form.data.storage_provider_id} onValueChange={(value) => form.setData('storage_provider_id', value)}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue placeholder="Select S3 storage provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageProviders.map((provider) => (
                      <SelectItem key={provider.id} value={String(provider.id)}>
                        {provider.profile}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={form.processing || !form.data.storage_provider_id}>
                  {form.processing ? <LoaderCircleIcon className="animate-spin" /> : <UploadCloudIcon />}
                  Back up to S3
                </Button>
              </form>
            </CardRow>
            <InputError message={form.errors.storage_provider_id} />
          </CardContent>
        </Card>
      </Container>
    </SettingsLayout>
  );
}
