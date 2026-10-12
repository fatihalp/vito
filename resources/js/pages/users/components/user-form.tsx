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
import { User } from '@/types/user';
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
    form.transform(({ project_access, ...data }) => data.role === 'admin' ? data : { ...data, project_access });
    const options = { onSuccess: () => onOpenChange(false) };
    if (user) {
      form.patch(`/admin/users/${user.id}`, options);
    } else {
      form.post('/admin/users', options);
    }
  };

  const setProjectAccess = (projectId: number, role: string) => {
    const access = form.data.project_access.filter((membership) => membership.project_id !== projectId);
    form.setData('project_access', role === 'none' ? access : [...access, { project_id: projectId, role }]);
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
              </section>
            )}
          </div>
          <section className="flex flex-col gap-5 rounded-lg border p-5">
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold">Access & permissions</h3>
              <p className="text-muted-foreground text-sm">Choose full system access or access to selected projects.</p>
            </div>
            <FormField>
              <Label htmlFor="role">Access level</Label>
              <Select value={form.data.role} onValueChange={(value) => form.setData('role', value)}>
                <SelectTrigger id="role" className="w-full sm:max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Selected projects</SelectItem>
                  <SelectItem value="admin">System administrator</SelectItem>
                </SelectContent>
              </Select>
              <InputError message={form.errors.role} />
            </FormField>
            {form.data.role === 'admin' ? (
              <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-4">
                <p className="text-sm font-medium">Full access to all projects and system settings</p>
                <p className="text-muted-foreground text-xs">Includes user management and all current and future projects. No project selection is needed. Existing project memberships are kept.</p>
              </div>
            ) : user ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-medium">Accessible projects ({form.data.project_access.length})</h4>
                    <p className="text-muted-foreground text-xs">Project access allows managing resources. Project owners also have ownership permissions, such as removing members and transferring servers.</p>
                  </div>
                  <div className="relative">
                    <SearchIcon className="text-muted-foreground absolute top-2.5 left-3 size-4" />
                    <Input aria-label="Search projects" placeholder="Search projects…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                </div>
                <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
                  {visibleProjects.map((project) => {
                    const membership = form.data.project_access.find((item) => item.project_id === project.id);
                    return (
                      <div key={project.id} className="flex flex-wrap items-center gap-3 p-3">
                        <Label htmlFor={`project-${project.id}`} className="min-w-0 flex-1 break-words">{project.name} <span className="text-muted-foreground text-xs">#{project.id}</span></Label>
                        <Select value={membership ? membership.role === 'owner' ? 'owner' : 'user' : 'none'} onValueChange={(role) => setProjectAccess(project.id, role)}>
                          <SelectTrigger id={`project-${project.id}`} className="w-44" aria-label={`Access to ${project.name}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No access</SelectItem>
                            <SelectItem value="user">Project access</SelectItem>
                            <SelectItem value="owner">Project owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  {!visibleProjects.length && <p className="text-muted-foreground p-4 text-sm">No matching projects.</p>}
                </div>
                <p className="text-muted-foreground text-xs">Changes apply when you save. A project must keep at least one owner.</p>
              </>
            ) : <p className="text-muted-foreground text-sm">Create the account first, then edit it to select its projects.</p>}
            {accessErrors.map(([key, message]) => <InputError key={key} message={message} />)}
          </section>
        </Form>
        <DialogFooter className="p-6">
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button form="user-form" type="submit" disabled={form.processing}>{form.processing && <LoaderCircle className="animate-spin" />}Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
