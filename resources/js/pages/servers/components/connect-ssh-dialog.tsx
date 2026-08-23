import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server } from '@/types/server';
import { Link } from '@inertiajs/react';
import { CheckIcon, CopyIcon, KeyRoundIcon, TerminalIcon, ShieldCheckIcon, ArrowRightIcon } from 'lucide-react';
import { useState } from 'react';

export default function ConnectSshDialog({
  server,
  children,
}: {
  server: Server;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const availableUsers = (server.ssh_users && server.ssh_users.length > 0)
    ? server.ssh_users
    : [server.ssh_user || 'root', 'root'].filter((v, i, a) => a.indexOf(v) === i);

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(id);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    });
  };

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TerminalIcon className="size-4" />
            </div>
            <div>
              <DialogTitle>Connect to {server.name}</DialogTitle>
              <DialogDescription className="text-xs">
                SSH connection commands and key-based access for {server.ip}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* User selector & Port info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg border">
            <div>
              <Label className="text-xs text-muted-foreground">SSH User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user} {user === server.ssh_user && '(default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-xs text-muted-foreground">Host &amp; Port</span>
              <span className="font-mono text-xs font-medium mt-1">
                {server.ip}:{server.port || 22}
              </span>
            </div>
          </div>

          <Tabs defaultValue="keys" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="keys">Deployed Keys ({deployedKeys.length})</TabsTrigger>
              <TabsTrigger value="custom">Custom Key</TabsTrigger>
              <TabsTrigger value="config">SSH Config</TabsTrigger>
            </TabsList>

            {/* Tab 1: Deployed SSH Keys */}
            <TabsContent value="keys" className="space-y-3 pt-3">
              {deployedKeys.length > 0 ? (
                <div className="space-y-2">
                  {deployedKeys.map((key) => {
                    const keyUser = key.user || selectedUser;
                    const keyCleanName = key.name.trim().replace(/\s+/g, '_');
                    const keyCommand = `ssh -i ~/.ssh/${keyCleanName} ${keyUser}@${server.ip}${portFlag}`;
                    const isCopied = copiedKey === `deployed-${key.id}`;

                    return (
                      <div key={key.id} className="rounded-lg border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheckIcon className="size-4 text-emerald-500 shrink-0" />
                            <span className="font-medium text-xs truncate">{key.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              user: {keyUser}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 text-xs gap-1.5"
                            onClick={() => copyToClipboard(keyCommand, `deployed-${key.id}`)}
                          >
                            {isCopied ? (
                              <>
                                <CheckIcon className="size-3.5 text-emerald-500" />
                                Copied
                              </>
                            ) : (
                              <>
                                <CopyIcon className="size-3.5" />
                                Copy SSH
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="bg-muted/70 rounded p-2 font-mono text-[11px] break-all select-all text-muted-foreground">
                          {keyCommand}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs space-y-2">
                  <p className="text-muted-foreground">No custom SSH keys deployed to this server yet.</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={route('server-ssh-keys', { server: server.id })}>
                      Deploy SSH Key
                    </Link>
                  </Button>
                </div>
              )}

              {/* Default SSH fallback */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5 mt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">Default SSH Connection (Default Key/Agent)</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={() => copyToClipboard(defaultCommand, 'default-cmd')}
                  >
                    {copiedKey === 'default-cmd' ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                    {copiedKey === 'default-cmd' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="bg-background rounded border p-2 font-mono text-[11px] break-all select-all">
                  {defaultCommand}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Link
                  href={route('server-ssh-keys', { server: server.id })}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  Manage all server SSH keys
                  <ArrowRightIcon className="size-3" />
                </Link>
              </div>
            </TabsContent>

            {/* Tab 2: Custom Key Path */}
            <TabsContent value="custom" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-key-path" className="text-xs">Local Private Key Path</Label>
                <Input
                  id="custom-key-path"
                  value={customKeyPath}
                  onChange={(e) => setCustomKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_ed25519_custom"
                  className="font-mono text-xs h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Specify the path to the private key on your local computer.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">Generated Command</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyToClipboard(customCommand, 'custom-cmd')}
                  >
                    {copiedKey === 'custom-cmd' ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" />
                        Copy Command
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-muted/70 rounded p-2.5 font-mono text-[11px] break-all select-all">
                  {customCommand}
                </div>
              </div>

              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
                <strong>Tip:</strong> If you get a permission denied error for your private key, ensure proper permissions:
                <code className="block mt-1 font-mono bg-background/80 px-2 py-0.5 rounded border">
                  chmod 600 {customKeyPath || '~/.ssh/id_ed25519_custom'}
                </code>
              </div>
            </TabsContent>

            {/* Tab 3: SSH Config */}
            <TabsContent value="config" className="space-y-3 pt-3">
              <p className="text-xs text-muted-foreground">
                Add this entry to your local <code className="font-mono text-foreground">~/.ssh/config</code> file to connect simply by running <code className="font-mono text-foreground">ssh {hostSlug}</code>:
              </p>
              <div className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium font-mono">~/.ssh/config</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyToClipboard(sshConfigSnippet, 'ssh-config')}
                  >
                    {copiedKey === 'ssh-config' ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" />
                        Copy Config
                      </>
                    )}
                  </Button>
                </div>
                <pre className="bg-muted/70 rounded p-3 font-mono text-[11px] overflow-x-auto select-all">
                  {sshConfigSnippet}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
