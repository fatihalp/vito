import { Button } from '@/components/ui/button';
import { Server, ServerWarning } from '@/types/server';
import { BannerItem, WarningsBlock } from '@/components/banners';
import { useDialog } from '@/hooks/use-dialog';
import { Link } from '@inertiajs/react';

export default function ServerBanners({ server }: { server: Server }) {
  const dialog = useDialog();
  const warnings: ServerWarning[] = server.warnings ?? [];
  const items: BannerItem[] = [];

  const rebootRequiredWarning = warnings.find((w) => w.key === 'reboot_required');
  const updatesWarning = warnings.find((w) => w.key === 'updates_available');
  const kernelUpdateWarning = warnings.find((w) => w.key === 'kernel_update_available');

  if (rebootRequiredWarning) {
    items.push({
      key: 'reboot-required',
      title: 'Restart required',
      description: 'The kernel or a critical package has been updated. Restart the server to complete the upgrade.',
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={route('servers.restart', { server: server.id, start: 1 })}>
            Restart
          </Link>
        </Button>
      ),
    });
  }

  if (server.status === 'updating') {
    items.push({
      key: 'server-updating',
      title: 'Package update in progress',
      description: <>Vito is applying package updates to this server. You can monitor the progress and view live console logs.</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={route('servers.update', { server: server.id })}>
            View progress
          </Link>
        </Button>
      ),
    });
  }

  if (updatesWarning && server.status !== 'updating') {
    const updatesCount = updatesWarning.count;
    items.push({
      key: 'package-updates',
      title: `${updatesCount} package ${updatesCount === 1 ? 'update' : 'updates'} available`,
      description: <>Install pending OS package updates to keep this server patched.</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={route('servers.update', { server: server.id, start: 1 })}>
            Update
          </Link>
        </Button>
      ),
    });
  }

  if (kernelUpdateWarning && server.status !== 'updating') {
    const kernelCount = kernelUpdateWarning.count;
    items.push({
      key: 'kernel-update',
      title: `Kernel update available`,
      description: <>Install the pending kernel {kernelCount === 1 ? 'package' : 'packages'} and restart to apply the new kernel.</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={route('servers.update', { server: server.id, type: 'kernel', start: 1 })}>
            Update &amp; restart
          </Link>
        </Button>
      ),
    });
  }

  if (server.status === 'disconnected') {
    items.push({
      key: 'server-offline',
      title: 'Server is offline',
      description: server.can_power_manage
        ? `This server is disconnected or stopped on ${server.provider}. Start it to bring hosted sites and services back online.`
        : 'This server is disconnected. Saved data is shown in read-only mode until the server reconnects.',
      action: server.can_power_manage ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            dialog.confirm.open({
              title: `Start ${server.name}?`,
              description: `Power on this server via ${server.provider}? The server will boot up and reconnect.`,
              confirmLabel: 'Start server',
              method: 'post',
              url: route('servers.start', server.id),
            })
          }
        >
          Start server
        </Button>
      ) : (
        <Button variant="outline" size="sm" asChild>
          <Link href={route('servers.restart', { server: server.id, start: 1 })}>
            Restart
          </Link>
        </Button>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <WarningsBlock items={items} summaryLabel={(count) => `${count} server warnings require your attention`} />
    </div>
  );
}
