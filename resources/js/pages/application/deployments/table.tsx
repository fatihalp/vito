import { Link, router } from '@inertiajs/react';
import moment from 'moment';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2Icon, Clock3Icon, GitBranchIcon, LoaderCircleIcon, RotateCcwIcon, XCircleIcon, type LucideIcon } from 'lucide-react';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VitoTable } from '@/components/vito-table';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import { Download, View } from '@/pages/server-logs/components/columns';
import { Deployment } from '@/types/deployment';
import DateTime from '@/components/date-time';
import { parseCommitMessage } from '@/lib/commit-message';
import { cn } from '@/lib/utils';
import CommitSummary from '@/pages/application/components/commit-summary';
import { formatDuration } from '@/pages/application/deployments/progress';

const deploymentUrl = (deployment: Deployment) =>
  `/servers/${encodeURIComponent(String(deployment.server_id))}/sites/${deployment.site_id}/deployments/${deployment.id}`;

const commitCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;
  const commit = deployment.commit_data ?? {};
  const branch = commit.message ? parseCommitMessage(commit.message).branch : null;
  const user = deployment.deployed_by ?? (deployment.trigger ? 'System' : null);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <CommitSummary commit={commit} className="text-sm" />
      <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap">
        <Link href={deploymentUrl(deployment)} className="hover:text-foreground shrink-0 font-mono">
          #{deployment.id}
        </Link>
        {deployment.commit_id_short && <span className="shrink-0 font-mono">· {deployment.commit_id_short}</span>}
        {branch && (
          <span className="inline-flex min-w-0 items-center gap-1" title={branch}>
            · <GitBranchIcon className="size-3 shrink-0" />
            <span className="truncate">{branch}</span>
          </span>
        )}
        {commit.date && (
          <span className="shrink-0" title={`${branch ? 'Merged' : 'Committed'} ${moment(commit.date).format('YYYY-MM-DD HH:mm:ss')}`}>
            · {branch ? 'merged' : 'committed'} {moment(commit.date).fromNow()}
          </span>
        )}
        {user && <span className="shrink-0">· {user}</span>}
        {deployment.trigger && deployment.trigger_color && (
          <Badge variant={deployment.trigger_color} className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-normal">
            {deployment.trigger}
          </Badge>
        )}
        {deployment.is_duplicate && (
          <Badge variant="warning" className="h-4 shrink-0 gap-0.5 px-1.5 py-0 text-[10px] font-normal" title="This commit was already deployed previously">
            <RotateCcwIcon className="size-2.5" />
            redeploy
          </Badge>
        )}
      </div>
    </div>
  );
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  deploying: LoaderCircleIcon,
  finished: CheckCircle2Icon,
  failed: XCircleIcon,
};

const statusCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;
  const Icon = STATUS_ICONS[deployment.status] ?? CheckCircle2Icon;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant={deployment.status_color} className="gap-1 capitalize">
        <Icon className={cn('size-3', deployment.status === 'deploying' && 'animate-spin')} />
        {deployment.status}
      </Badge>
      {deployment.active && <span className="text-success text-[10px] font-medium uppercase tracking-wide">Live</span>}
    </div>
  );
};

const deployedAtCell = ({ row }: CellRenderProps) => {
  const deployment = row as unknown as Deployment;

  return (
    <div className="flex flex-col gap-1 text-xs whitespace-nowrap">
      <DateTime date={deployment.created_at} relative className="text-foreground" />
      <span className="text-muted-foreground inline-flex items-center gap-1 font-mono">
        <Clock3Icon className="size-3" />
        {deployment.status === 'deploying' ? 'running' : deployment.duration != null ? formatDuration(deployment.duration) : '—'}
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
      columnWidths={{ actions: '3.25rem', status: '7rem', created_at: '8.5rem' }}
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
