import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { FormEvent } from 'react';

export default function SSLSettings({ vitoSsl, vitoDomain }: { vitoSsl: boolean; vitoDomain: string }) {
  const page = usePage();
  const vitoMode = (page.props as { vito_mode?: string }).vito_mode;

  const form = useForm({
    ssl: vitoSsl,
    domain: vitoDomain,
    email: '',
  });

  if (vitoMode === 'dev') {
    return null;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('vito-settings.ssl'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SSL Configuration</CardTitle>
        <CardDescription>Configure SSL for Vito using FrankenPHP&apos;s built-in ACME support</CardDescription>
      </CardHeader>
      <Form id="ssl-settings-form" onSubmit={submit}>
        <CardContent>
          <FormFields>
            <FormField>
              <div className="flex items-center gap-2">
                <Switch id="ssl" checked={form.data.ssl} onCheckedChange={(checked) => form.setData('ssl', checked)} />
                <Label htmlFor="ssl">Enable SSL</Label>
              </div>
              <InputError message={form.errors.ssl} />
            </FormField>
            {form.data.ssl && (
              <>
                <FormField>
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    type="text"
                    value={form.data.domain}
                    onChange={(e) => form.setData('domain', e.target.value)}
                    placeholder="vito.example.com"
                  />
                  <InputError message={form.errors.domain} />
                </FormField>
                <FormField>
                  <Label htmlFor="email">Email (for Let&apos;s Encrypt)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                    placeholder="admin@example.com"
                  />
                  <InputError message={form.errors.email} />
                </FormField>
              </>
            )}
          </FormFields>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
