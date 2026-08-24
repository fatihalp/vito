import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InviteeSelect from '@/pages/projects/components/invitee-select';
import QuickCreateUserDialog from '@/pages/projects/components/quick-create-user-dialog';
import { Project } from '@/types/project';
import { useForm } from '@inertiajs/react';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircleIcon, UserPlusIcon } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function Invite({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}) {
  const queryClient = useQueryClient();
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateEmail, setQuickCreateEmail] = useState('');

  const form = useForm<{ user_id: number | null; role: string }>({
    user_id: null,
    role: 'user',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    form.post(route('projects.users.store', { project: project.id }), {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['project-invitees', project.id] });
        onOpenChange(false);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle>Invite user to {project.name}</DialogTitle>
                <DialogDescription>
                  Select a Vito user and choose their role. They will be asked to accept the invitation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form id="invite-form" onSubmit={submit} className="p-4">
            <FormFields>
              <FormField>
                <div className="flex items-center justify-between">
                  <Label htmlFor="invite-user">User</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-primary gap-1 -mr-1 hover:bg-primary/10"
                    onClick={() => {
                      setQuickCreateEmail('');
                      setShowQuickCreate(true);
                    }}
                  >
                    <UserPlusIcon className="size-3.5" />
                    <span>Create new user</span>
                  </Button>
                </div>
                <InviteeSelect
                  id="invite-user"
                  projectId={project.id}
                  value={form.data.user_id}
                  onValueChange={(user) => form.setData('user_id', user.id)}
                  onCreateUserRequest={(email) => {
                    setQuickCreateEmail(email);
                    setShowQuickCreate(true);
                  }}
                />
                <InputError message={form.errors.user_id} />
              </FormField>
              <FormField>
                <Label htmlFor="role">Role</Label>
                <Select value={form.data.role} onValueChange={(value) => form.setData('role', value)}>
                  <SelectTrigger id="role" name="role" className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <InputError message={form.errors.role} />
              </FormField>
            </FormFields>
          </Form>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button form="invite-form" type="submit" disabled={form.processing || form.data.user_id === null}>
              {form.processing && <LoaderCircleIcon className="animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickCreateUserDialog
        open={showQuickCreate}
        onOpenChange={setShowQuickCreate}
        projectId={project.id}
        defaultEmail={quickCreateEmail}
        onUserCreated={(newUser) => {
          form.setData('user_id', newUser.id);
        }}
      />
    </>
  );
}
