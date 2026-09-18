import { StorageMigration } from '@/types/storage-migration';
import { StorageMigrationItem } from '@/types/storage-migration-item';
import { ColumnDef } from '@tanstack/react-table';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import DateTime from '@/components/date-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CopyableBadge from '@/components/copyable-badge';
import ErrorIndicator from '@/components/error-indicator';
import { formatBytes } from '@/lib/utils';
import { ExternalLinkIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

function PreviewButton({ item, side, label }: { item: StorageMigrationItem; side: 'source' | 'target'; label: string }) {
  const page = usePage<SharedData & { storageMigration: StorageMigration }>();
  const isAdmin = page.props.auth.user?.is_admin;
  const [loading, setLoading] = useState(false);

  if (!isAdmin) {
    return null;
  }

  const preview = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<{ url: string }>(
        route('storage-migrations.items.preview', { storageMigration: page.props.storageMigration.id, item: item.id }),
        { params: { side } },
      );
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(`Could not generate a preview link for the ${side} object.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={loading} onClick={() => void preview()}>
      {loading ? <LoaderCircleIcon className="animate-spin" /> : <ExternalLinkIcon />}
      {label}
    </Button>
  );
}

export const columns: ColumnDef<StorageMigrationItem>[] = [
  {
    accessorKey: 'target_key',
    header: 'Object',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => <CopyableBadge text={row.original.target_key} tooltip />,
  },
  {
    accessorKey: 'size',
    header: 'Size',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => (row.original.size === null ? '-' : formatBytes(row.original.size, 2)),
  },
  {
    accessorKey: 'attempts',
    header: 'Attempts',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => row.original.attempts,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5">
        <Badge variant={row.original.status_color}>{row.original.status}</Badge>
        <ErrorIndicator error={row.original.error} label={`Object "${row.original.target_key}" error`} />
      </div>
    ),
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated at',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => <DateTime date={row.original.updated_at} relative />,
  },
  {
    id: 'preview',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <PreviewButton item={row.original} side="source" label="Source" />
        <PreviewButton item={row.original} side="target" label="Target" />
      </div>
    ),
  },
];
