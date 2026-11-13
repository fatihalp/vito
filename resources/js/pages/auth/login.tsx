import { useTranslate } from '@/hooks/use-translate';
import { Head, useForm, usePage } from '@inertiajs/react';
import { LoaderCircleIcon } from 'lucide-react';
import { FormEvent } from 'react';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth/layout';

export default function Login() {
  const translateText = useTranslate();
  const page = usePage<{
    demo: boolean;
  }>();

  const form = useForm<{
    email: string;
    password: string;
    remember: boolean;
  }>({
    email: page.props.demo ? 'demo@vitodeploy.com' : '',
    password: page.props.demo ? 'password' : '',
    remember: false,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post('/login', {
      onFinish: () => form.reset('password'),
    });
  };

  return (
    <AuthLayout title={translateText('Log in')} showFooter={false}>
      <Head title={translateText('Log in')} />

      <form onSubmit={submit}>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="email">{translateText('Email address')}</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              tabIndex={1}
              autoComplete="email"
              value={form.data.email}
              onChange={(e) => form.setData('email', e.target.value)}
              placeholder="email@example.com"
            />
            <InputError message={form.errors.email} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="password">{translateText('Password')}</Label>
            <Input
              id="password"
              type="password"
              required
              tabIndex={2}
              autoComplete="current-password"
              value={form.data.password}
              onChange={(e) => form.setData('password', e.target.value)}
              placeholder={translateText('Password')}
            />
            <InputError message={form.errors.password} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              name="remember"
              checked={form.data.remember}
              onClick={() => form.setData('remember', !form.data.remember)}
              tabIndex={3}
            />
            <Label htmlFor="remember">{translateText('Remember me')}</Label>
          </div>

          <Button type="submit" className="mt-4 w-full" tabIndex={4} disabled={form.processing}>
            {form.processing && <LoaderCircleIcon className="animate-spin" />}
            {translateText('Log in')}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
