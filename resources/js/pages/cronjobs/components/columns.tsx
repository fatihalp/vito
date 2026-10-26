import { ColumnDef } from '@tanstack/react-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { Link, useForm } from '@inertiajs/react';
import { Clock3Icon, LoaderCircleIcon, PlayIcon } from 'lucide-react';
import FormSuccessful from '@/components/form-successful';
import { CronJob } from '@/types/cronjob';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DateTime from '@/components/date-time';
import CopyableBadge from '@/components/copyable-badge';
import { Site } from '@/types/site';
import { useDialog } from '@/hooks/use-dialog';

function getCronJobUrl(cronJob: CronJob, site?: Site): string {
  return site
    ? `/servers/${cronJob.server_id}/sites/${site.id}/cronjobs/${cronJob.id}`
    : `/servers/${cronJob.server_id}/cronjobs/${cronJob.id}`;
}

function Action({ type, cronJob }: { type: 'enable' | 'disable'; cronJob: CronJob; site?: Site }) {
  const form = useForm();

  const submit = () => {
    form.post(`/servers/${cronJob.server_id}/cronjobs/${cronJob.id}/${type}`);
  };

  return (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={submit} disabled={form.processing}>
      {form.processing && <LoaderCircleIcon className="mr-2 h-4 w-4 animate-spin" />}
      <FormSuccessful successful={form.recentlySuccessful} />
      {type === 'enable' ? 'Enable' : 'Disable'}
    </DropdownMenuItem>
  );
}

function Delete({ cronJob }: { cronJob: CronJob; site?: Site }) {
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: 'Delete cron job',
          description: 'Are you sure you want to delete this cron job? This action cannot be undone.',
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/servers/${cronJob.server_id}/cronjobs/${cronJob.id}`,
        })
      }
    >
      Delete
    </DropdownMenuItem>
  );
}

function Actions({ cronJob, site }: { cronJob: CronJob; site?: Site }) {
  const dialog = useDialog();
  const runForm = useForm();
  const showUrl = getCronJobUrl(cronJob, site);
  const executeUrl = `${showUrl}/execute`;

  const runCronJob = () => {
    runForm.post(executeUrl);
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Button variant="ghost" size="sm" asChild>
        <Link href={showUrl}>
          <Clock3Icon className="size-3.5" />
          <span>Logs</span>
        </Link>
      </Button>
      <Button size="sm" onClick={runCronJob} disabled={runForm.processing}>
        {runForm.processing ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <PlayIcon className="size-3.5" />}
        <span>Run</span>
      </Button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={runCronJob} disabled={runForm.processing}>
            Run now
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={showUrl}>View logs</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => dialog.cronjobForm.open({ serverId: cronJob.server_id, site, cronJob })}>Edit</DropdownMenuItem>
          {cronJob.status === 'disabled' && <Action type="enable" cronJob={cronJob} site={site} />}
          {cronJob.status === 'ready' && <Action type="disable" cronJob={cronJob} site={site} />}
          <DropdownMenuSeparator />
          <Delete cronJob={cronJob} site={site} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getColumns(site?: Site, sites?: Array<{ id: number; domain: string }>): ColumnDef<CronJob>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        const showUrl = getCronJobUrl(row.original, site);
        return (
          <Link href={showUrl} className="font-medium hover:underline">
            {row.original.name || <i className="text-muted-foreground font-normal">No name</i>}
          </Link>
        );
      },
    },
    {
      accessorKey: 'command',
      header: 'Command',
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        return <CopyableBadge text={row.original.command} />;
      },
    },
    {
      accessorKey: 'user',
      header: 'User',
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      accessorKey: 'site_id',
      header: 'Site',
      enableColumnFilter: true,
      enableSorting: true,
      cell: ({ row }) => {
        const siteId = row.original.site_id;
        if (!siteId) {
          return <span>-</span>;
        }
        const matchedSite = sites?.find((s) => s.id === siteId);
        return <span>{matchedSite ? matchedSite.domain : `Site #${siteId}`}</span>;
      },
    },
    {
      accessorKey: 'frequency',
      header: 'Frequency',
      enableColumnFilter: true,
      enableSorting: true,
    },
    {
      id: 'last_execution',
      header: 'Last run',
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => {
        const lastExecution = row.original.last_execution;
        if (!lastExecution) {
          return <span className="text-muted-foreground text-xs">Never</span>;
        }

        const showUrl = getCronJobUrl(row.original, site);
        return (
          <Link href={showUrl} className="inline-flex flex-col items-start gap-0.5 hover:underline">
            <Badge variant={lastExecution.status_color}>{lastExecution.status}</Badge>
            <span className="text-muted-foreground text-[11px]">
              <DateTime date={lastExecution.created_at} />
            </span>
          </Link>
        );
      },
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
      id: 'actions',
      enableColumnFilter: false,
      enableSorting: false,
      cell: ({ row }) => {
        return <Actions cronJob={row.original} site={site} />;
      },
    },
  ];
}

export { getColumns as columns };
