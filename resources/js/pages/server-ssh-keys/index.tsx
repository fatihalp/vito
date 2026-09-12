import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDialog } from '@/hooks/use-dialog';
import ServerLayout from '@/layouts/server/layout';
import ConnectSshDialog from '@/pages/servers/components/connect-ssh-dialog';
import DeployKey from '@/pages/server-ssh-keys/components/deploy-key';
import { Server } from '@/types/server';
import type { InertiaTableData } from '@forjedio/inertia-table-react';
import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronLeftIcon, ChevronRightIcon, CopyIcon, KeyRoundIcon, PlusIcon, TrashIcon, UserIcon } from 'lucide-react';
import { toast } from 'sonner';

type DeployedKeyRow = {
  id: number;
  name: string;
  owner?: string;
  owner_email?: string;
  deployment_user?: string;
  created_at?: string;
};

type PageProps = {
  sshKeys: InertiaTableData;
  server: Server;
};

export default function SshKeys() {
  const page = usePage<PageProps>();
  const server = page.props.server;
  const dialog = useDialog();

  const deployedKeys = ((page.props.sshKeys?.data as unknown as DeployedKeyRow[]) ?? []).filter(Boolean);

  const portFlag = server.port && server.port !== 22 ? ` -p ${server.port}` : '';

  const copyCommand = (cmd: string) => {
    navigator.clipboard
      .writeText(cmd)
      .then(() => toast.success('SSH command copied to clipboard'))
      .catch(() => toast.error('Failed to copy command'));
  };

  const deleteKey = (key: DeployedKeyRow) => {
    dialog.confirm.open({
      title: `Remove ${key.name} from ${server.name}?`,
      description: `This key will be removed from authorized_keys for user "${key.deployment_user || server.ssh_user}" on ${server.name} and will no longer be able to authenticate.`,
      variant: 'destructive',
      confirmLabel: 'Remove key',
      method: 'delete',
      url: route('server-ssh-keys.destroy', { server: server.id, sshKey: key.id }),
    });
  };

  return (
    <ServerLayout>
      <Head title={`SSH Keys - ${server.name}`} />
      <Container className="max-w-5xl space-y-6">
        <HeaderContainer>
          <div>
            <Heading title="SSH Keys" />
            <p className="text-muted-foreground text-xs">
              Manage authorized SSH keys for {server.name} ({server.ip}).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ConnectSshDialog server={server} />
            <DeployKey>
              <Button size="sm" className="gap-1.5">
                <PlusIcon className="size-3.5" />
                Deploy SSH key
              </Button>
            </DeployKey>
          </div>
        </HeaderContainer>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Authorized SSH Keys</h3>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {deployedKeys.length} deployed
            </Badge>
          </div>

          {deployedKeys.length > 0 ? (
            <div className="flex flex-col gap-3">
              {deployedKeys.map((key) => {
                const targetUser = key.deployment_user || server.ssh_user || 'root';
                const keyCmd = `ssh ${targetUser}@${server.ip}${portFlag}`;

                return (
                  <Card key={key.id} className="w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <KeyRoundIcon className="size-4.5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{key.name}</span>
                            <Badge variant="outline" className="font-mono text-xs gap-1 font-normal">
                              <UserIcon className="size-3" />
                              {targetUser}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            {key.owner && (
                              <span>
                                Owner: <span className="text-foreground font-medium">{key.owner}</span>
                              </span>
                            )}
                            {key.created_at && <span>Added {key.created_at}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1.5 font-mono"
                          onClick={() => copyCommand(keyCmd)}
                          title="Copy SSH command"
                        >
                          <CopyIcon className="size-3.5" />
                          Copy ssh
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteKey(key)}
                          aria-label={`Remove ${key.name} from server`}
                          title="Remove from server"
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-full mb-3">
                  <KeyRoundIcon className="size-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">No SSH keys deployed yet</h4>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Deploy an SSH key to enable passwordless authentication and connect securely from your terminal.
                </p>
                <DeployKey>
                  <Button size="sm" className="gap-1.5">
                    <PlusIcon className="size-3.5" />
                    Deploy SSH key
                  </Button>
                </DeployKey>
              </CardContent>
            </Card>
          )}

          {(page.props.sshKeys?.links?.next || page.props.sshKeys?.links?.prev) && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!page.props.sshKeys.links.prev}
                asChild={!!page.props.sshKeys.links.prev}
              >
                {page.props.sshKeys.links.prev ? (
                  <Link href={page.props.sshKeys.links.prev}>
                    <ChevronLeftIcon className="mr-1 size-3.5" /> Previous
                  </Link>
                ) : (
                  <span>
                    <ChevronLeftIcon className="mr-1 size-3.5" /> Previous
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!page.props.sshKeys.links.next}
                asChild={!!page.props.sshKeys.links.next}
              >
                {page.props.sshKeys.links.next ? (
                  <Link href={page.props.sshKeys.links.next}>
                    Next <ChevronRightIcon className="ml-1 size-3.5" />
                  </Link>
                ) : (
                  <span>
                    Next <ChevronRightIcon className="ml-1 size-3.5" />
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>
      </Container>
    </ServerLayout>
  );
}
