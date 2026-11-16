import { useTranslate } from '@/hooks/use-translate';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Link, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import type { SharedData } from '@/types';
import { FormEvent } from 'react';
import { LoaderCircleIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';

export default function UpdateProfile() {
  const translateText = useTranslate();
  const page = usePage<
    SharedData & {
      must_verify_email: boolean;
    }
  >();

  const form = useForm<{
    name: string;
    email: string;
  }>({
    name: page.props.auth.user.name,
    email: page.props.auth.user.email,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();

    form.put('/user/profile-information', {
      preserveScroll: true,
      errorBag: 'updateProfileInformation',
    });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{translateText('Profile information')}</CardTitle>
        <CardDescription>{translateText('Update your profile information and email address.')}</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <form id="update-profile-form" onSubmit={submit}>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name">{translateText('Name')}</Label>
              <Input
                id="name"
                value={form.data.name}
                onChange={(e) => form.setData('name', e.target.value)}
                autoComplete="name"
                placeholder={translateText('Full name')}
              />
              <InputError message={form.errors.name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">{translateText('Email address')}</Label>
              <Input
                id="email"
                type="email"
                value={form.data.email}
                onChange={(e) => form.setData('email', e.target.value)}
                autoComplete="username"
                placeholder={translateText('Email address')}
              />
              <InputError message={form.errors.email} />
            </div>
            {page.props.must_verify_email && page.props.auth.user.email_verified_at === null && (
              <div>
                <p className="text-muted-foreground -mt-4 text-sm">
                  {translateText('Your email address is unverified.')}{' '}
                  <Link href="/email/verification-notification" method="post" as="button" className="text-foreground underline">
                    {translateText('Click here to resend the verification email.')}
                  </Link>
                </p>
                {page.props.status === 'verification-link-sent' && (
                  <div className="text-success mt-2 text-sm font-medium">{translateText('A new verification link has been sent to your email address.')}</div>
                )}
              </div>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter className="gap-2">
        <Button form="update-profile-form" disabled={form.processing}>
          {form.processing && <LoaderCircleIcon className="animate-spin" />}
          <FormSuccessful successful={form.recentlySuccessful} />
          {translateText('Save')}
        </Button>
      </CardFooter>
    </Card>
  );
}
