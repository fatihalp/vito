import { Head, useForm, usePage, usePoll } from '@inertiajs/react';
import Container from '@/components/container';
import HeaderContainer from '@/components/header-container';
import Heading from '@/components/heading';
import SettingsLayout from '@/layouts/settings/layout';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable } from '@/components/data-table';
import { PaginatedData } from '@/types';
import { StorageMigration } from '@/types/storage-migration';
import { StorageMigrationItem } from '@/types/storage-migration-item';
import { columns } from '@/pages/storage-migrations/components/item-columns';
import StorageMigrationActions from '@/pages/storage-migrations/components/storage-migration-actions';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import { formatBytes } from '@/lib/utils';
import { formatStorageMigrationProgress } from '@/components/storage-migration-progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/ui/input-error';

type Page = {
  storageMigration: StorageMigration;
  items: PaginatedData<StorageMigrationItem>;
  itemsAvailable: boolean;
  scanDatabase: { server: string | null; database: string } | null;
};

export default function ShowStorageMigration() {
  const page = usePage<Page>();
  const storageMigration = useRealtimeRecord<StorageMigration>(page.props.storageMigration, 'storage-migration') ?? page.props.storageMigration;

  usePoll(5000, { only: ['storageMigration', 'items', 'itemsAvailable'] });
  const workers = useForm({ worker_count: page.props.storageMigration.worker_count });
  const isOpen = ['pending', 'scanning', 'running', 'verifying', 'paused'].includes(storageMigration.status);
  const transferLabel = storageMigration.transfer_paused ? 'paused' : !isOpen ? storageMigration.status : storageMigration.status === 'verifying' ? 'verifying' : storageMigration.items_processing > 0 ? 'processing files' : !storageMigration.scan_completed_at && !storageMigration.target_scan_completed_at ? 'waiting for the target listing' : storageMigration.items_total === storageMigration.items_copied + storageMigration.items_skipped + storageMigration.items_failed && !storageMigration.scan_completed_at ? 'waiting for discovery' : 'waiting for a worker';

  const progress = storageMigration.progress;
  const progressText = formatStorageMigrationProgress(progress);
  const direction = `${storageMigration.source?.name ?? 'Source'} → ${storageMigration.target?.name ?? 'Target'}`;

  return (
    <SettingsLayout>
      <Head title={storageMigration.name ?? 'Storage Migration'} />

      <Container className="max-w-5xl">
        <HeaderContainer>
          <Heading title={storageMigration.name ?? direction} description={storageMigration.name ? direction : undefined} />
          <div className="flex items-center gap-2">
            <Badge variant={storageMigration.syncing ? 'success' : 'gray'}>{storageMigration.syncing ? 'syncing' : 'not syncing'}</Badge>
            <Badge variant={storageMigration.status_color}>{storageMigration.status}</Badge>
            <StorageMigrationActions storageMigration={storageMigration} />
          </div>
        </HeaderContainer>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Scan: {storageMigration.scan_completed_at ? 'complete' : storageMigration.scan_paused ? 'paused' : storageMigration.status === 'cancelled' || storageMigration.status === 'failed' ? 'stopped' : storageMigration.target_scan_completed_at ? 'discovering' : 'listing target'}</Badge>
            <Badge variant="outline">Transfers: {transferLabel}</Badge>
            {page.props.scanDatabase && (
              <Badge variant="outline">
                Scan database: {page.props.scanDatabase.server} / {page.props.scanDatabase.database}
              </Badge>
            )}
          </div>
          <Progress value={progress} />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>{progressText}</span>
            <span>{(storageMigration.items_copied + storageMigration.items_skipped).toLocaleString()} / {storageMigration.items_total.toLocaleString()} objects</span>
            {storageMigration.items_processing > 0 && <span>{storageMigration.items_processing.toLocaleString()} files assigned to workers</span>}
            <span>{formatBytes(storageMigration.bytes_copied, 2)} / {formatBytes(storageMigration.bytes_total, 2)}</span>
            {storageMigration.items_skipped > 0 && <span>{storageMigration.items_skipped} already on target</span>}
            {storageMigration.items_failed > 0 && <span className="text-destructive">{storageMigration.items_failed} failed</span>}
          </div>
          {storageMigration.status === 'scanning' && !storageMigration.scan_paused && (
            <div className="text-muted-foreground text-sm">
              Still discovering objects on the source storage. Totals grow as more objects are found.
              {storageMigration.transfer_paused ? ' Transfers are paused.' : ' Discovered objects can transfer before scanning finishes.'}
            </div>
          )}
          {(storageMigration.scan_paused || storageMigration.transfer_paused) && (
            <p className="text-muted-foreground text-sm">Paused work finishes its current page or file before stopping. Resume each phase from the actions menu.</p>
          )}
          {storageMigration.error && <div className="text-destructive text-sm">{storageMigration.error}</div>}
        </div>

        {isOpen && (
          <form className="flex flex-col gap-3" onSubmit={(event) => {
            event.preventDefault();
            workers.post(route('storage-migrations.workers', { storageMigration: storageMigration.id }), { preserveScroll: true });
          }}>
            <Label htmlFor="migration-workers">Transfer workers for this migration</Label>
            <div className="flex items-center gap-2">
              <Input id="migration-workers" type="number" min={1} max={storageMigration.max_worker_count} value={workers.data.worker_count}
                onChange={(event) => workers.setData('worker_count', Number(event.target.value))} className="w-24" />
              <Button type="submit" disabled={workers.processing}>Save workers</Button>
            </div>
            <InputError message={workers.errors.worker_count} />
            <p className="text-muted-foreground text-sm">
              Current limit: {storageMigration.worker_count}. Shared worker capacity: {storageMigration.worker_capacity}.
              Changes apply between files. The shared queue capacity limits how many workers can run across all migrations.
              If transfers keep waiting, check that Horizon is running the storage-migration queue.
            </p>
          </form>
        )}

        {!page.props.itemsAvailable && (
          <p className="text-muted-foreground text-sm">Scan data is not available yet. It appears once Vito can reach the scan database.</p>
        )}

        <DataTable columns={columns} paginatedData={page.props.items} />
      </Container>
    </SettingsLayout>
  );
}
