import CopyableField from '@/components/copyable-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server } from '@/types/server';
import { Link } from '@inertiajs/react';
import { KeyRoundIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';

export default function ConnectSshDialog({ server, children }: { server: Server; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const availableUsers = server.ssh_users && server.ssh_users.length > 0 ? server.ssh_users : [server.ssh_user || 'root'];
  const [selectedUser, setSelectedUser] = useState<string>(server.ssh_user || 'root');

  const portFlag = server.port && server.port !== 22 ? ` -p ${server.port}` : '';
  const command = `ssh ${selectedUser}@${server.ip}${portFlag}`;

  const sshPort = server.port && server.port !== 22 ? `:${server.port}` : '';
  const sshUrl = `ssh://${selectedUser}@${server.ip}${sshPort}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <KeyRoundIcon className="size-4" />
            Connect
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <TerminalIcon className="size-4" />
            </div>
            <div>
              <DialogTitle>Connect to {server.name}</DialogTitle>
              <DialogDescription>
                SSH access for {server.ip}{sshPort}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-4 pb-2">
          {availableUsers.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">SSH user</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 w-full text-xs">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((availableUser) => (
                    <SelectItem key={availableUser} value={availableUser}>
                      {availableUser}
                      {availableUser === server.ssh_user && ' (default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Command</Label>
            <div className="flex items-center gap-2">
              <CopyableField value={command} className="h-9 flex-1 font-mono text-xs" />
              <Button size="sm" className="h-9 gap-1.5 shrink-0 cursor-pointer" asChild>
                <a href={sshUrl}>
                  <TerminalIcon className="size-3.5" />
                  <span>Launch</span>
                </a>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-3">
          <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0 text-xs" asChild>
            <Link href={route('server-ssh-keys', { server: server.id })}>Manage SSH keys</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
