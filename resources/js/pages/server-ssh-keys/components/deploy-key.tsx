import { CheckIcon, KeyRoundIcon, LoaderCircle, PlusIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm, usePage } from '@inertiajs/react';
import { FormEventHandler, ReactNode, useState } from 'react';
import InputError from '@/components/ui/input-error';
import { Server } from '@/types/server';
import { SshKey } from '@/types/ssh-key';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AddSshKey from '@/pages/ssh-keys/components/add-ssh-key';
import { cn } from '@/lib/utils';

export default function DeployKey({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const page = usePage<{ server: Server }>();
  const server = page.props.server;

  const serverUsers = server.ssh_users && server.ssh_users.length > 0 ? server.ssh_users : [server.ssh_user || 'root'];

  const query = useQuery<SshKey[]>({
    queryKey: ['sshKey'],
    queryFn: async () => (await axios.get(route('ssh-keys.json'))).data,
    enabled: open,
  });

  const form = useForm<Required<{ key: string; user: string }>>({
    key: '',
    user: serverUsers[0] || 'root',
  });

  const submit: FormEventHandler = (e) => {
    e.preventDefault();
    form.post(route('server-ssh-keys.store', { server: server.id }), {
      preserveScroll: true,
      onSuccess: () => {
        setOpen(false);
        form.reset('key');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-1.5">
            <KeyRoundIcon className="size-3.5" />
            Deploy SSH key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deploy SSH key</DialogTitle>
          <DialogDescription>
            Select a key and a user to deploy on {server.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 pb-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground">SSH Keys</h4>
              <AddSshKey onKeyAdded={() => query.refetch()}>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                  <PlusIcon className="size-3" />
                  Add
                </Button>
              </AddSshKey>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y">
                {query.isLoading && (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                  </div>
                )}
                {query.isSuccess && query.data.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <p className="text-xs text-muted-foreground">No SSH keys yet</p>
                  </div>
                )}
                {query.isSuccess &&
                  query.data.map((sshKey) => (
                    <button
                      key={sshKey.id}
                      type="button"
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors',
                        form.data.key === sshKey.id.toString()
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/50',
                      )}
                      onClick={() => form.setData('key', sshKey.id.toString())}
                    >
                      <KeyRoundIcon className="size-3.5 shrink-0" />
                      <span className="truncate text-xs font-medium">{sshKey.name}</span>
                      {form.data.key === sshKey.id.toString() && (
                        <CheckIcon className="size-3.5 ml-auto shrink-0" />
                      )}
                    </button>
                  ))}
              </div>
            </div>
            <InputError message={form.errors.key} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Server Users</h4>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y">
                {serverUsers.map((user) => (
                  <button
                    key={user}
                    type="button"
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2.5 text-left text-sm transition-colors',
                      form.data.user === user ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
                    )}
                    onClick={() => form.setData('user', user)}
                  >
                    <UserIcon className="size-3.5 shrink-0" />
                    <span className="truncate text-xs font-medium font-mono">{user}</span>
                    {user === server.ssh_user && (
                      <span className="text-[10px] text-muted-foreground ml-1">default</span>
                    )}
                    {form.data.user === user && <CheckIcon className="size-3.5 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
            <InputError message={form.errors.user} />
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={submit} disabled={!form.data.key || !form.data.user || form.processing}>
            {form.processing && <LoaderCircle className="mr-1.5 size-3.5 animate-spin" />}
            Deploy key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
