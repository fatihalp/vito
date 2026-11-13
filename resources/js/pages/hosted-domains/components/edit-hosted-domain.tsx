import { useTranslate } from '@/hooks/use-translate';
import { FormEvent } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { LoaderCircleIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HostedDomain } from '@/types/hosted-domain';
import { Site } from '@/types/site';
import FormSuccessful from '@/components/form-successful';
import { useSslMatching } from '@/pages/hosted-domains/hooks/use-ssl-matching';

type EditForm = {
  domain: string;
  type: string;
  ssl_method: string;
  ssl_id: string;
};

const SSL_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'Disabled' },
  { value: 'letsencrypt', label: "Generate Let's Encrypt Certificate" },
  { value: 'custom', label: 'Custom Certificate' },
];

export default function EditHostedDomain({
  open,
  onOpenChange,
  hostedDomain,
  installSsl = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostedDomain: HostedDomain;
  installSsl?: boolean;
}) {
  const translateText = useTranslate();
  const { site } = usePage<{ site: Site }>().props;
  const isPrimary = hostedDomain.type === 'primary';

  const allowedMethods = site.webserver_allowed_ssl_methods;
  const filteredSslOptions = allowedMethods ? SSL_METHOD_OPTIONS.filter((o) => allowedMethods.includes(o.value)) : SSL_METHOD_OPTIONS;

  const form = useForm<EditForm>({
    domain: hostedDomain.domain,
    type: hostedDomain.type,
    ssl_method: installSsl ? 'letsencrypt' : hostedDomain.ssl_method,
    ssl_id: hostedDomain.ssl_id ? String(hostedDomain.ssl_id) : '',
  });

  const { matchingSsls, loadingSsls, sslStale, handleSslMethodChange } = useSslMatching({
    serverId: hostedDomain.server_id,
    siteId: hostedDomain.site_id,
    domain: form.data.domain,
    sslId: form.data.ssl_id,
    applySslSettings: ({ ssl_method, ssl_id }) => {
      form.setData('ssl_method', ssl_method);
      form.setData('ssl_id', ssl_id);
    },
    open,
    originalDomain: hostedDomain.domain,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.put(
      `/servers/${hostedDomain.server_id}/sites/${hostedDomain.site_id}/domains/${hostedDomain.id}`,
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{installSsl ? `Install SSL for ${hostedDomain.domain}` : translateText("Edit Domain")}</DialogTitle>
          <DialogDescription className="sr-only">{installSsl ? translateText("Install SSL certificate") : translateText("Edit hosted domain")}</DialogDescription>
        </DialogHeader>
        <Form className="p-4" id="edit-hosted-domain-form" onSubmit={submit}>
          <FormFields>
            <FormField>
              <Label htmlFor="edit-domain">{translateText('Domain')}</Label>
              <Input
                type="text"
                id="edit-domain"
                name="domain"
                value={form.data.domain}
                onChange={(e) => form.setData('domain', e.target.value)}
                placeholder="example.com"
                disabled={isPrimary}
              />
              <InputError message={form.errors.domain} />
            </FormField>
            <FormField>
              <Label htmlFor="edit-type">{translateText('Type')}</Label>
              <Select onValueChange={(value) => form.setData('type', value)} value={form.data.type} disabled={isPrimary}>
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder={translateText('Select type')} />
                </SelectTrigger>
                <SelectContent>
                  {isPrimary && <SelectItem value="primary">{translateText('Primary')}</SelectItem>}
                  <SelectItem value="alias">Alias</SelectItem>
                  <SelectItem value="redirect">{translateText('Redirect')}</SelectItem>
                </SelectContent>
              </Select>
              {!isPrimary && (
                <p className="text-muted-foreground text-sm">
                  <strong>Alias</strong> {translateText("serves the same site content under another domain.")} <strong>{translateText('Redirect')}</strong> {translateText("sends visitors to the primary domain via an HTTP redirect.")}
                </p>
              )}
              <InputError message={form.errors.type} />
            </FormField>
            <FormField>
              <Label htmlFor="edit-ssl-method">SSL</Label>
              <Select onValueChange={handleSslMethodChange} value={form.data.ssl_method}>
                <SelectTrigger id="edit-ssl-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredSslOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputError message={form.errors.ssl_method} />
            </FormField>
            {form.data.ssl_method === 'custom' && (
              <FormField>
                <Label htmlFor="edit-ssl_id">{translateText("SSL Certificate")}</Label>
                <Select onValueChange={(value) => form.setData('ssl_id', value)} value={form.data.ssl_id}>
                  <SelectTrigger id="edit-ssl_id">
                    <SelectValue placeholder={loadingSsls ? translateText("Loading...") : translateText("Select a certificate")} />
                  </SelectTrigger>
                  <SelectContent>
                    {matchingSsls.map((ssl) => (
                      <SelectItem key={ssl.id} value={String(ssl.id)}>
                        {ssl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-sm">
                  {translateText("Only server-level SSL certificates that match the domain you entered will appear here. Add certificates via the server SSL settings.")}
                </p>
                <InputError message={form.errors.ssl_id} />
              </FormField>
            )}
          </FormFields>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {translateText('Cancel')}
            </Button>
          </DialogClose>
          <Button type="button" onClick={submit} disabled={form.processing || loadingSsls || sslStale}>
            {(form.processing || loadingSsls || sslStale) && <LoaderCircleIcon className="animate-spin" />}
            <FormSuccessful successful={form.recentlySuccessful} />
            {translateText('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
