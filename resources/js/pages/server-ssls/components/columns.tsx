import { useTranslate } from '@/hooks/use-translate';
import { ColumnDef } from '@tanstack/react-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import DateTime from '@/components/date-time';
import { SSL } from '@/types/ssl';
import moment from 'moment';
import { View } from '@/pages/server-logs/components/columns';
import ActivateServerSsl from '@/pages/server-ssls/components/activate-server-ssl';
import { useDialog } from '@/hooks/use-dialog';
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

function Delete({ ssl }: { ssl: SSL }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Delete SSL',
          description: 'Are you sure you want to delete this certificate?',
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/servers/${ssl.server_id}/ssl/${ssl.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}

export const columns: ColumnDef<SSL>[] = [
  {
    id: 'application',
    header: 'Application',
    cell: ({ row }) => row.original.site_id ? <Link className="text-primary hover:underline" href={`/servers/${row.original.server_id}/sites/${row.original.site_id}/domains`}>{row.original.site_domain || 'Open application'}</Link> : 'Server certificate',
  },
  {
    accessorKey: 'type',
    header: 'Type',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      return <Badge variant="default">{row.original.type.toUpperCase()}</Badge>;
    },
  },
  {
    id: 'domain',
    header: 'Domain(s)',
    enableColumnFilter: true,
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.domains && row.original.domains.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            <TooltipProvider>
              {row.original.domains.map((domain) => {
                const truncated = domain.length > 30;
                const label = truncated ? domain.slice(0, 30) + '...' : domain;
                return truncated ? (
                  <Tooltip key={domain}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="cursor-default">
                        {label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{domain}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Badge key={domain} variant="outline">
                    {label}
                  </Badge>
                );
              })}
            </TooltipProvider>
          </div>
        );
      }
      return <span>-</span>;
    },
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
    accessorKey: 'expires_at',
    header: 'Expires in',
    enableColumnFilter: true,
    enableSorting: true,
    cell: ({ row }) => {
      if (!row.original.expires_at) {
        return <span className="text-muted-foreground">Expiry not tracked</span>;
      }

      const targetDate = moment(row.original.expires_at);
      const today = moment();
      const expired = targetDate.isSameOrBefore(today);
      const daysRemaining = Math.ceil(targetDate.diff(today, 'days', true));

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={expired || daysRemaining <= 7 ? 'danger' : daysRemaining <= 30 ? 'warning' : 'outline'} className="cursor-default">
                {expired ? 'Expired' : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{targetDate.format('MMMM D, YYYY')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    id: 'renewal',
    header: 'Renewal',
    cell: ({ row }) => row.original.type === 'letsencrypt' ? 'Let’s Encrypt' : row.original.type === 'csr' ? 'Awaiting certificate' : 'Managed externally',
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
  {
    accessorKey: 'id',
    header: 'ID',
    enableColumnFilter: false,
    enableSorting: true,
  },
  {
    id: 'actions',
    enableColumnFilter: false,
    enableSorting: false,
    cell: ({ row }) => {
      if (row.original.site_id) {
        return <Button variant="outline" size="sm" asChild><Link href={`/servers/${row.original.server_id}/sites/${row.original.site_id}/domains`}>Manage SSL</Link></Button>;
      }
      return (
        <div className="flex items-center gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <TableActionTrigger />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {row.original.has_csr && row.original.status === 'created' && (
                <>
                  <DropdownMenuItem
                    onSelect={() => window.open(`/servers/${row.original.server_id}/ssl/${row.original.id}/download`, '_blank')}
                  >
                    Download CSR
                  </DropdownMenuItem>
                  {row.original.type === 'csr' && <ActivateServerSsl ssl={row.original} />}
                  <DropdownMenuSeparator />
                </>
              )}
              {row.original.log && (
                <>
                  <View serverLog={row.original.log} label="View Log" />
                  <DropdownMenuSeparator />
                </>
              )}
              <Delete ssl={row.original} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
