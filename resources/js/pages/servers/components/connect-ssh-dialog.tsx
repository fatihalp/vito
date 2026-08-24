import CopyableField from '@/components/copyable-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server } from '@/types/server';
import { Link } from '@inertiajs/react';
import { CopyIcon, KeyRoundIcon, ShieldCheckIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function ConnectSshDialog({ server, children }: { server: Server; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const availableUsers = server.ssh_users && server.ssh_users.length > 0 ? server.ssh_users : [server.ssh_user || 'root'];
  const [selectedUser, setSelectedUser] = useState<string>(server.ssh_user || 'root');
  const [customKeyPath, setCustomKeyPath] = useState<string>('~/.ssh/id_ed25519_custom');

  const portFlag = server.port && server.port !== 22 ? ` -p ${server.port}` : '';
  const defaultCommand = `ssh ${selectedUser}@${server.ip}${portFlag}`;
  const customCommand = `ssh -i ${customKeyPath || '~/.ssh/id_ed25519'} ${selectedUser}@${server.ip}${portFlag}`;

  const hostSlug = (server.name || 'vito-server')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-');

  const sshConfigSnippet = `Host ${hostSlug}
  HostName ${server.ip}
  User ${selectedUser}
  Port ${server.port || 22}
  IdentityFile ${customKeyPath || '~/.ssh/id_ed25519'}`;

  const deployedKeys = server.ssh_keys ?? [];

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <TerminalIcon className="size-4" />
            </div>
            <div>
              <DialogTitle>Connect to {server.name}</DialogTitle>
              <DialogDescription>SSH access for {server.ip}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-4 pb-2">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-muted-foreground text-xs">SSH user</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-9 w-full">
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
            <Badge variant="outline" className="h-9 gap-1.5 rounded-md px-3 font-mono text-xs font-normal">
              {server.ip}:{server.port || 22}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Quick connect</Label>
            <CopyableField value={defaultCommand} className="h-9" />
          </div>

          <Tabs defaultValue="keys" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="keys">Deployed keys ({deployedKeys.length})</TabsTrigger>
              <TabsTrigger value="custom">Custom key</TabsTrigger>
              <TabsTrigger value="config">SSH config</TabsTrigger>
            </TabsList>

            <TabsContent value="keys" className="space-y-2 pt-3">
              {deployedKeys.length > 0 ? (
                deployedKeys.map((key) => {
                  const keyUser = key.user || selectedUser;
                  const keyCleanName = key.name.trim().replace(/\s+/g, '_');
                  const keyCommand = `ssh -i ~/.ssh/${keyCleanName} ${keyUser}@${server.ip}${portFlag}`;

                  return (
                    <div key={key.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheckIcon className="text-success size-4 shrink-0" />
                        <span className="truncate text-xs font-medium">{key.name}</span>
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                          user: {keyUser}
                        </Badge>
                      </div>
                      <CopyableField value={keyCommand} />
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2 rounded-lg border border-dashed p-6 text-center">
                  <p className="text-muted-foreground text-xs">No custom SSH keys deployed to this server yet.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={route('server-ssh-keys', { server: server.id })}>Deploy SSH key</Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-key-path" className="text-xs">
                  Local private key path
                </Label>
                <Input
                  id="custom-key-path"
                  value={customKeyPath}
                  onChange={(e) => setCustomKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_ed25519_custom"
                  className="h-9 font-mono text-xs"
                />
              </div>
              <CopyableField value={customCommand} />
              <p className="text-muted-foreground text-[11px]">
                Permission denied? Run{' '}
                <code className="bg-muted rounded px-1 py-0.5 font-mono">chmod 600 {customKeyPath || '~/.ssh/id_ed25519_custom'}</code>
              </p>
            </TabsContent>

            <TabsContent value="config" className="space-y-2 pt-3">
              <p className="text-muted-foreground text-xs">
                Add to <code className="text-foreground font-mono">~/.ssh/config</code>, then connect with{' '}
                <code className="text-foreground font-mono">ssh {hostSlug}</code>.
              </p>
              <div className="bg-muted/50 relative rounded-lg border">
                <pre className="overflow-x-auto p-3 pr-11 font-mono text-[11px]">{sshConfigSnippet}</pre>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute top-1.5 right-1.5 size-7"
                  aria-label="Copy SSH config"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(sshConfigSnippet)
                      .then(() => toast.success('Copied to clipboard'))
                      .catch(() => toast.error('Failed to copy to clipboard'));
                  }}
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="link" size="sm" className="text-muted-foreground mr-auto h-auto p-0" asChild>
            <Link href={route('server-ssh-keys', { server: server.id })}>Manage SSH keys</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
