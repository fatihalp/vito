import { ColumnDef } from '@tanstack/react-table';
import DateTime from '@/components/date-time';
import { WorkflowRun } from '@/types/workflow-run';
import { Badge } from '@/components/ui/badge';
import Duration from './duration';

export const columns: ColumnDef<WorkflowRun>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    enableColumnFilter: true,
    enableSorting: true,
  },

  {
    accessorKey: 'created_at',
    header: 'Created at',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <DateTime date={row.original.created_at} />;
    },
  },
  {
    accessorKey: 'duration_seconds',
    header: 'Duration',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => <Duration workflowRun={row.original} />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <Badge variant={row.original.status_color}>{row.original.status}</Badge>;
    },
  },
];
