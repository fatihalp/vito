import { useTranslate } from '@/hooks/use-translate';
import ServerOfflineBanner from '@/components/server-offline-banner';
import { withQuery } from '@/lib/url';
import { Button } from '@/components/ui/button';
import { Server, ServerWarning } from '@/types/server';
import { BannerItem, WarningsBlock } from '@/components/banners';
import { Link } from '@inertiajs/react';

export default function ServerBanners({ server }: { server: Server }) {
  const translateText = useTranslate();
  const warnings: ServerWarning[] = server.warnings ?? [];
  const items: BannerItem[] = [];

  const rebootRequiredWarning = warnings.find((w) => w.key === 'reboot_required');
  const updatesWarning = warnings.find((w) => w.key === 'updates_available');
  const kernelUpdateWarning = warnings.find((w) => w.key === 'kernel_update_available');
  const backupsWarning = warnings.find((w) => w.key === 'backups_need_attention');

  if (rebootRequiredWarning) {
    items.push({
      key: 'reboot-required',
      title: 'Restart required',
      description: 'The kernel or a critical package has been updated. Restart the server to complete the upgrade.',
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={`/servers/${server.id}/restart`}>
            {translateText("Review restart")}
          </Link>
        </Button>
      ),
    });
  }

  if (server.status === 'updating') {
    items.push({
      key: 'server-updating',
      title: 'Package update in progress',
      description: <>{translateText("Pure is applying package updates to this server. You can monitor the progress and view live console logs.")}</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={`/servers/${server.id}/update`}>
            {translateText("View progress")}
          </Link>
        </Button>
      ),
    });
  }

  if (updatesWarning && server.status !== 'updating') {
    const updatesCount = updatesWarning.count;
    items.push({
      key: 'package-updates',
      title: translateText(updatesCount === 1 ? ':count package update available' : ':count package updates available', { count: updatesCount }),
      description: <>{translateText("Install pending OS package updates to keep this server patched.")}</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={`/servers/${server.id}/update`}>
            {translateText("Review updates")}
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
      description: <>{translateText("Install the pending kernel")} {kernelCount === 1 ? translateText("package") : translateText("packages")} {translateText("and restart to apply the new kernel.")}</>,
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={withQuery(`/servers/${server.id}/update`, { type: 'kernel' })}>
            {translateText("Review kernel update")}
          </Link>
        </Button>
      ),
    });
  }

  if (backupsWarning) {
    items.push({
      key: 'backups-need-attention',
      title: translateText(backupsWarning.count === 1 ? ':count backup needs attention' : ':count backups need attention', { count: backupsWarning.count }),
      description: 'A backup failed, stopped running on schedule, or pgBackRest reported a WAL or repository problem.',
      action: (
        <Button variant="outline" size="sm" asChild className="cursor-pointer">
          <Link href={`/servers/${server.id}/backups`}>{translateText("View backups")}</Link>
        </Button>
      ),
    });
  }


  if (items.length === 0 && server.status !== 'disconnected') return null;

  return (
    <div className="flex flex-col gap-3">
      {server.status === 'disconnected' && <ServerOfflineBanner server={server} />}
      <WarningsBlock items={items} summaryLabel={(count) => translateText(':count server warnings require your attention', { count })} />
    </div>
  );
}
