import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormField, FormFields } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { LoaderCircleIcon, RefreshCwIcon, UserPlusIcon } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

function generateRandomPassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function QuickCreateUserDialog({
  open,
  onOpenChange,
  projectId,
  defaultEmail = '',
  onUserCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  defaultEmail?: string;
  onUserCreated?: (user: { id: number; name: string; email: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      if (!name && defaultEmail.includes('@')) {
        const usernamePart = defaultEmail.split('@')[0];
        setName(usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1));
      }
      if (!password) {
        setPassword(generateRandomPassword());
      }
      setErrors({});
    }
  }, [open, defaultEmail]);

  const handleGeneratePassword = () => {
    setPassword(generateRandomPassword());
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const response = await axios.post<{ id: number; name: string; email: string }>(
        route('projects.users.quick-create', { project: projectId }),
        {
          name,
          email,
          password,
          role,
        },
      );

      toast.success(`User ${response.data.name} created successfully.`);
      void queryClient.invalidateQueries({ queryKey: ['project-invitees', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });

      if (onUserCreated) {
        onUserCreated(response.data);
      }

      onOpenChange(false);
      setName('');
      setEmail('');
      setPassword('');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.errors) {
        const fieldErrors: Record<string, string> = {};
        Object.entries(err.response.data.errors as Record<string, string[]>).forEach(([key, messages]) => {
          fieldErrors[key] = messages[0];
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Failed to create user. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserPlusIcon className="size-4" />
            </div>
            <div>
              <DialogTitle>Quick create user</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Create a new Vito account and immediately invite them to this project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form id="quick-create-user-form" onSubmit={submit} className="p-4 space-y-4">
          <FormFields className="space-y-3">
            <FormField>
              <Label htmlFor="quick-user-name" className="text-xs font-medium">
                Full Name
              </Label>
              <Input
                id="quick-user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="h-9 text-xs"
                required
              />
              <InputError message={errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="quick-user-email" className="text-xs font-medium">
                Email Address
              </Label>
              <Input
                id="quick-user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="h-9 text-xs"
                required
              />
              <InputError message={errors.email} />
            </FormField>

            <FormField>
              <div className="flex items-center justify-between">
                <Label htmlFor="quick-user-password" className="text-xs font-medium">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCwIcon className="size-3" />
                  <span>Generate</span>
                </button>
              </div>
              <PasswordInput
                id="quick-user-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="h-9 text-xs"
                required
              />
              <InputError message={errors.password} />
            </FormField>

            <FormField>
              <Label htmlFor="quick-user-role" className="text-xs font-medium">
                Instance Role
              </Label>
              <Select value={role} onValueChange={(val: 'user' | 'admin') => setRole(val)}>
                <SelectTrigger id="quick-user-role" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="user" className="text-xs">
                      Standard User
                    </SelectItem>
                    <SelectItem value="admin" className="text-xs">
                      Instance Admin
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <InputError message={errors.role} />
            </FormField>
          </FormFields>
        </Form>

        <DialogFooter className="p-4 pt-2 border-t bg-muted/10 flex items-center justify-between">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" className="text-xs">
              Cancel
            </Button>
          </DialogClose>
          <Button
            form="quick-create-user-form"
            type="submit"
            size="sm"
            disabled={loading || !name || !email || !password}
            className="text-xs"
          >
            {loading && <LoaderCircleIcon className="mr-1.5 size-3.5 animate-spin" />}
            Create & Select
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
