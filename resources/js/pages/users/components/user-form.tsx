import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormEventHandler, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoaderCircle, SearchIcon } from 'lucide-react';
import { useForm, usePage } from '@inertiajs/react';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { User, UserProjectAccess } from '@/types/user';
import DateTime from '@/components/date-time';

export default function UserForm({ user, open, onOpenChange }: { user?: User; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { projects } = usePage<{ projects: { id: number; name: string }[] }>().props;
  const [search, setSearch] = useState('');
  const form = useForm({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.is_admin ? 'admin' : 'user',
    must_change_password: user ? !!user.must_change_password : true,
    project_access: (user?.project_access ?? []).map(({ project_id, role }) => ({ project_id, role })),
  });
  const visibleProjects = projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()));
  const accessErrors = Object.entries(form.errors).filter(([key]) => key.startsWith('project_access'));

  const submit: FormEventHandler = (event) => {
    event.preventDefault();
    const options = { onSuccess: () => onOpenChange(false) };
    if (user) {
      form.patch(`/admin/users/${user.id}`, options);
    } else {
      form.post('/admin/users', options);
    }
  };

  const toggleProject = (projectId: number, enabled: boolean) => {
    form.setData('project_access', enabled
      ? [...form.data.project_access, { project_id: projectId, role: 'user' }]
      : form.data.project_access.filter((membership) => membership.project_id !== projectId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={user ? 'max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-6xl' : 'max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl'} onCloseAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader className="p-6">
          <DialogTitle>{user ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>{user ? `${user.name} · ${user.email}` : 'Create an account and configure its security settings.'}</DialogDescription>
        </DialogHeader>
        <Form id="user-form" onSubmit={submit} className="overflow-y-auto p-6">
          <div className={user ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
            <section className="flex flex-col gap-5 rounded-lg border p-5">
              <h3 className="font-semibold">Account & security</h3>
              <FormFields className="gap-5">
                <FormField>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                  <InputError message={form.errors.name} />
                </FormField>
                <FormField>
                  <Label htmlFor="email">Email</Label>
                  <Input type="email" id="email" required value={form.data.email} onChange={(event) => form.setData('email', event.target.value)} />
                  <InputError message={form.errors.email} />
                </FormField>
                <FormField>
                  <Label htmlFor="password">{user ? 'New password' : 'Password'}</Label>
                  <Input type="password" id="password" autoComplete="new-password" required={!user} minLength={8}
                    pattern={String.raw`(?=.*\p{Lu})(?=.*[\p{P}\p{S}]).{8,}`} aria-describedby="user-password-hint"
                    title="Use at least 8 characters, an uppercase letter and a special character."
                    value={form.data.password} onChange={(event) => form.setData('password', event.target.value)} />
                  <InputError message={form.errors.password} />
                  <p id="user-password-hint" className="text-muted-foreground text-xs">At least 8 characters, one uppercase letter and one special character.{user && ' Leave blank to keep the current password.'}</p>
                </FormField>
                <FormField>
                  <Label htmlFor="role">Account role</Label>
                  <Select value={form.data.role} onValueChange={(value) => form.setData('role', value)}>
                    <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">{form.data.role === 'admin' ? 'Admins can access all projects, regardless of the memberships below.' : 'Users can access the projects they belong to.'}</p>
                  <InputError message={form.errors.role} />
                </FormField>
                <FormField>
                  <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="must_change_password">Force password change</Label>
                      <p className="text-muted-foreground text-xs">Require a new password on the next login.</p>
                    </div>
                    <Switch id="must_change_password" checked={form.data.must_change_password} onCheckedChange={(checked) => form.setData('must_change_password', checked)} />
                  </div>
                  <InputError message={form.errors.must_change_password} />
                </FormField>
              </FormFields>
            </section>
            {user && (
              <section className="flex flex-col gap-5 rounded-lg border p-5">
                <h3 className="font-semibold">Activity & login details</h3>
                <dl className="grid gap-5 sm:grid-cols-2">
                  {([
                    ['Password last set / changed', user.password_changed_at],
                    ['Last action', user.last_activity_at],
                    ['Last login', user.last_login_at],
                    ['Account created', user.created_at],
                  ] as const).map(([label, date]) => (
                    <div key={label} className="flex flex-col gap-1.5">
                      <dt className="text-muted-foreground text-xs">{label}</dt>
                      <dd className="text-sm font-medium">{date ? <DateTime date={date} /> : 'Not recorded'}</dd>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5"><dt className="text-muted-foreground text-xs">Last login browser</dt><dd className="text-sm font-medium">{user.last_login_browser || 'Not recorded'}</dd></div>
                  <div className="flex flex-col gap-1.5"><dt className="text-muted-foreground text-xs">Last login language</dt><dd className="text-sm font-medium">{user.last_login_language || 'Not recorded'}</dd></div>
                </dl>
                <p className="text-muted-foreground text-xs">Login details are captured on successful sign-in. Activity timestamps are updated at most once per minute. Older password changes may not have been recorded.</p>
                {user.last_login_user_agent && (
                  <details className="rounded-md bg-muted/40 p-3 text-xs">
                    <summary className="cursor-pointer font-medium">Browser identification</summary>
                    <p className="text-muted-foreground pt-3 font-mono break-all">{user.last_login_user_agent}</p>
                  </details>
                )}
                <div className="flex flex-col gap-3 border-t pt-4">
                  <h4 className="text-sm font-medium">Current project access</h4>
                  {user.is_admin && <Badge>All projects · Admin</Badge>}
                  <div className="flex flex-wrap gap-2">
                    {(user.project_access ?? []).map((membership: UserProjectAccess) => <Badge key={membership.project_id} variant="outline">{membership.name || `Project #${membership.project_id}`} · {membership.role}</Badge>)}
                    {!user.is_admin && !user.project_access?.length && <span className="text-muted-foreground text-sm">No project memberships</span>}
                  </div>
                </div>
              </section>
            )}
          </div>
          {user && (
            <section className="flex flex-col gap-4 rounded-lg border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">Project memberships <span className="text-muted-foreground font-normal">({form.data.project_access.length} selected)</span></h3>
                  <p className="text-muted-foreground text-xs">Select projects and choose a role for each. Changes apply when you save.</p>
                </div>
                <div className="relative">
                  <SearchIcon className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                  <Input aria-label="Search projects" placeholder="Search projects…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                {visibleProjects.map((project) => {
                  const membership = form.data.project_access.find((item) => item.project_id === project.id);
                  return (
                    <div key={project.id} className="flex flex-wrap items-center gap-3 p-3">
                      <Checkbox id={`project-${project.id}`} checked={!!membership} onCheckedChange={(checked) => toggleProject(project.id, checked === true)} />
                      <Label htmlFor={`project-${project.id}`} className="min-w-0 flex-1 break-words">{project.name} <span className="text-muted-foreground text-xs">#{project.id}</span></Label>
                      {membership ? (
                        <Select value={membership.role} onValueChange={(role) => form.setData('project_access', form.data.project_access.map((item) => item.project_id === project.id ? { ...item, role } : item))}>
                          <SelectTrigger className="w-32" aria-label={`Role in ${project.name}`}><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="owner">Owner</SelectItem></SelectContent>
                        </Select>
                      ) : <span className="text-muted-foreground text-xs">No membership</span>}
                    </div>
                  );
                })}
                {!visibleProjects.length && <p className="text-muted-foreground p-4 text-sm">No matching projects.</p>}
              </div>
              {accessErrors.map(([key, message]) => <InputError key={key} message={message} />)}
            </section>
          )}
        </Form>
        <DialogFooter className="p-6">
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button form="user-form" type="submit" disabled={form.processing}>{form.processing && <LoaderCircle className="animate-spin" />}Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
