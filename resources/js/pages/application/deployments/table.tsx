import { Link, router } from '@inertiajs/react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { CheckCircle2Icon, LoaderCircleIcon, RotateCcwIcon, XCircleIcon, type LucideIcon } from 'lucide-react';
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

type DeploymentState = 'live' | 'deploying' | 'finished' | 'failed';

const deploymentState = (deployment: Deployment): DeploymentState =>
  deployment.active ? 'live' : (['deploying', 'failed'].includes(deployment.status) ? deployment.status : 'finished') as DeploymentState;

const STATE_LABELS: Record<DeploymentState, { label: string; className: string }> = {
  live: { label: 'Live', className: 'text-success' },
  deploying: { label: 'Deploying', className: 'text-info' },
  finished: { label: 'Finished', className: 'text-muted-foreground' },
  failed: { label: 'Failed', className: 'text-destructive' },
};

function StateGlyph({ state }: { state: DeploymentState }) {
  if (state === 'live') {
    return (
      <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="bg-success/25 absolute size-4 animate-pulse rounded-full" />
        <span className="bg-success size-2 rounded-full" />
      </span>
    );
  }

  const Icon: LucideIcon = { deploying: LoaderCircleIcon, finished: CheckCircle2Icon, failed: XCircleIcon }[state];

  return <Icon className={cn('size-4 shrink-0', STATE_LABELS[state].className, state === 'deploying' && 'animate-spin')} aria-hidden="true" />;
}

const commitCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;
  const state = deploymentState(deployment);
  const actor = deploymentActor(deployment);
  const duration = state !== 'deploying' && deployment.duration != null ? formatDuration(deployment.duration) : null;
  const details = [duration, actor].filter(Boolean);

  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-5 items-center">
        <StateGlyph state={state} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CommitSummary commit={deployment.commit_data} className="text-sm" />
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className={cn('shrink-0 font-medium', STATE_LABELS[state].className)}>{STATE_LABELS[state].label}</span>
          {details.map((detail) => (
            <span key={detail} className="truncate">
              · {detail}
            </span>
          ))}
          {deployment.is_duplicate && (
            <span className="text-warning inline-flex shrink-0 items-center gap-1" title="This commit was already deployed previously">
              · <RotateCcwIcon className="size-3.5" />
              Redeploy
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const deployedAtCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;

  return (
    <div className="flex flex-col gap-1 whitespace-nowrap">
      <DateTime date={deployment.created_at} relative className="text-foreground text-sm" />
      <DateTime date={deployment.created_at} format="MMM D, HH:mm" className="text-muted-foreground text-[13px] tabular-nums" />
    </div>
  );
};

function DeploymentRowActions({ deployment }: { deployment: Deployment }) {
  const dialog = useDialog();

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <TableActionTrigger variant="ghost" className="shadow-none" />
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
      columnWidths={{ actions: '3.25rem', created_at: '8.5rem' }}
      tableData={deployments}
      showPagination={showPagination}
      reloadOnly={['deployments']}
      onRowClick={(row: Row) => router.visit(deploymentUrl(row as unknown as Deployment))}
      cellRenderers={{
        commit: commitCell,
        created_at: deployedAtCell,
      }}
      actions={(row: Row) => <DeploymentRowActions deployment={asRow<Deployment>(row, ['id', 'site_id', 'server_id'])} />}
    />
  );
}
