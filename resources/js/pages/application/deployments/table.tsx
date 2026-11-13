import { Link, router } from '@inertiajs/react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2Icon, LoaderCircleIcon, RotateCcwIcon, TimerIcon, XCircleIcon, type LucideIcon } from 'lucide-react';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VitoTable } from '@/components/vito-table';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import { Download, View } from '@/pages/server-logs/components/columns';
import { Deployment } from '@/types/deployment';
import DateTime from '@/components/date-time';
import { cn } from '@/lib/utils';
import CommitSummary from '@/pages/application/components/commit-summary';
import { formatDuration } from '@/pages/application/deployments/progress';

const deploymentUrl = (deployment: Deployment) =>
  `/servers/${encodeURIComponent(String(deployment.server_id))}/sites/${deployment.site_id}/deployments/${deployment.id}`;

const deploymentActor = (deployment: Deployment): string | null =>
  deployment.trigger === 'manual' || !deployment.trigger ? deployment.deployed_by : deployment.trigger;

const commitCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;
  const actor = deploymentActor(deployment);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <CommitSummary commit={deployment.commit_data} className="text-sm" />
      {(actor || deployment.is_duplicate) && (
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[13px]">
          {actor && <span className="truncate">{actor}</span>}
          {actor && deployment.is_duplicate && <span aria-hidden="true">·</span>}
          {deployment.is_duplicate && (
            <span className="text-warning inline-flex shrink-0 items-center gap-1" title="This commit was already deployed previously">
              <RotateCcwIcon className="size-3.5" />
              Redeploy
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const STATUS_STYLES: Record<string, { icon: LucideIcon; className: string }> = {
  deploying: { icon: LoaderCircleIcon, className: 'text-info [&>svg]:animate-spin' },
  finished: { icon: CheckCircle2Icon, className: 'text-muted-foreground' },
  failed: { icon: XCircleIcon, className: 'text-destructive' },
};

const statusCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;

  if (deployment.active) {
    return (
      <Badge variant="success" className="gap-1.5 px-2.5 py-1 text-[13px]">
        <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
        Live
      </Badge>
    );
  }

  const { icon: Icon, className } = STATUS_STYLES[deployment.status] ?? STATUS_STYLES.finished;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium capitalize', className)}>
      <Icon className="size-3.5" />
      {deployment.status}
    </span>
  );
};

const deployedAtCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;

  return (
    <div className="flex flex-col gap-1 whitespace-nowrap">
      <DateTime date={deployment.created_at} relative className="text-foreground text-sm" />
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[13px] tabular-nums">
        <TimerIcon className="size-3.5" />
        {deployment.status === 'deploying' ? 'Running' : deployment.duration != null ? formatDuration(deployment.duration) : '—'}
      </span>
    </div>
  );
};

function DeploymentRowActions({ deployment }: { deployment: Deployment }) {
  const dialog = useDialog();

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href={deploymentUrl(deployment)}>
              View details
            </Link>
          </DropdownMenuItem>
          {deployment.log && (
            <>
              <View serverLog={deployment.log} />
              <Download serverLog={deployment.log}>
                <DropdownMenuItem>Download</DropdownMenuItem>
              </Download>
            </>
          )}
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              dialog.confirm.open({
                title: `Delete release [${deployment.release || deployment.id}]`,
                description: `Are you sure you want to delete release ${deployment.release || deployment.id}? This will delete the release files from the server. This action cannot be undone.`,
                variant: 'destructive',
                confirmLabel: 'Delete',
                method: 'delete',
                url: deploymentUrl(deployment),
              })
            }
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function DeploymentsTable({
  deployments,
  showPagination = true,
  modal = false,
}: {
  deployments: InertiaTableData;
  showPagination?: boolean;
  modal?: boolean;
}) {
  if (!deployments?.columns) {
    return null;
  }

  return (
    <VitoTable
      modal={modal}
      columnWidths={{ actions: '3.25rem', status: '7.5rem', created_at: '9.5rem' }}
      tableData={deployments}
      showPagination={showPagination}
      reloadOnly={['deployments']}
      onRowClick={(row: Row) => router.visit(deploymentUrl(row as unknown as Deployment))}
      cellRenderers={{
        commit: commitCell,
        created_at: deployedAtCell,
        status: statusCell,
      }}
      actions={(row: Row) => <DeploymentRowActions deployment={asRow<Deployment>(row, ['id', 'site_id', 'server_id'])} />}
    />
  );
}
