import { Link } from '@inertiajs/react';
import type { CellRenderProps, InertiaTableData, Row } from '@forjedio/inertia-table-react';
import { Badge } from '@/components/ui/badge';
import { TableActionTrigger } from '@/components/table-action-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VitoTable } from '@/components/vito-table';
import { useDialog } from '@/hooks/use-dialog';
import { asRow } from '@/lib/inertia-table';
import { Download, View } from '@/pages/server-logs/components/columns';
import { Deployment } from '@/types/deployment';

const commitCell = ({ row }: CellRenderProps) => {
  const commit = (row.commit_data ?? {}) as Deployment['commit_data'];
  if (!commit.message) {
    return <span className="text-muted-foreground">No message</span>;
  }

  const href = commit.url && /^https?:\/\//.test(commit.url) ? commit.url : undefined;

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex truncate font-mono">
      <span className="block max-w-[200px] overflow-x-hidden overflow-ellipsis">{commit.message}</span>
    </a>
  ) : (
    <span className="inline-flex truncate font-mono">
      <span className="block max-w-[200px] overflow-x-hidden overflow-ellipsis">{commit.message}</span>
    </span>
  );
};

const releaseCell = ({ row }: CellRenderProps) => (
  <div className="inline-flex items-center gap-2">
    {(row.release as string | null) ?? ''}
    {(row.active as boolean) && <Badge variant="default">active</Badge>}
  </div>
);

export default function DeploymentsTable({ deployments, showPagination = true }: { deployments: InertiaTableData; showPagination?: boolean }) {
  const dialog = useDialog();

  return (
    <VitoTable
      tableData={deployments}
      showPagination={showPagination}
      cellRenderers={{ commit: commitCell, release: releaseCell }}
      actions={(row: Row) => {
        const deployment = asRow<Deployment>(row, ['id', 'site_id', 'server_id']);

        return (
          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <TableActionTrigger />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild>
                  <Link
                    href={route('application.deployments.show', {
                      server: deployment.server_id,
                      site: deployment.site_id,
                      deployment: deployment.id,
                    })}
                  >
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
                {!deployment.active && deployment.release && deployment.status === 'finished' && (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      dialog.confirm.open({
                        title: 'Rollback',
                        description: `Are you sure you want to rollback your site to version [${deployment.release}]?`,
                        confirmLabel: 'Rollback',
                        method: 'post',
                        url: route('application.rollback', {
                          server: deployment.server_id,
                          site: deployment.site_id,
                          deployment: deployment.id,
                        }),
                      })
                    }
                  >
                    Rollback
                  </DropdownMenuItem>
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
                      url: route('application.deployments.destroy', {
                        server: deployment.server_id,
                        site: deployment.site_id,
                        deployment: deployment.id,
                      }),
                    })
                  }
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }}
    />
  );
}
