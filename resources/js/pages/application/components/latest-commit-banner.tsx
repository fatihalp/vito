import { useState } from 'react';
import moment from 'moment';
import { AlertTriangleIcon, GitCommitHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Deploy from '@/pages/application/components/deploy';
import CommitSummary from '@/pages/application/components/commit-summary';
import { parseCommitMessage } from '@/lib/commit-message';
import { Deployment, LatestCommit } from '@/types/deployment';
import { Site } from '@/types/site';

export default function LatestCommitBanner({
  site,
  latestCommit,
  activeDeployment,
}: {
  site: Site;
  latestCommit: LatestCommit | null | undefined;
  activeDeployment: Deployment | null;
}) {
  const [dismissedCommit, setDismissedCommit] = useState<string | null>(null);

  if (latestCommit?.error) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 border-t px-4 py-2 text-xs">
        <AlertTriangleIcon className="text-warning size-3.5 shrink-0" />
        <span className="truncate" title={latestCommit.error}>
          Could not check {site.branch} for new commits: {latestCommit.error}
        </span>
      </div>
    );
  }

  const commitId = latestCommit?.commit_id;
  if (!commitId || latestCommit.deployed || dismissedCommit === commitId || activeDeployment?.commit_id === commitId) {
    return null;
  }

  const commit = latestCommit.commit_data ?? {};
  const merged = commit.message ? Boolean(parseCommitMessage(commit.message).branch) : false;

  return (
    <div className="bg-info/5 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center">
      <GitCommitHorizontalIcon className="text-info hidden size-5 shrink-0 sm:block" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-info shrink-0 font-medium">New commit on {site.branch}</span>
          <CommitSummary commit={commit} />
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="font-mono">{commitId.slice(0, 7)}</span>
          {commit.name && <span>· {commit.name}</span>}
          {commit.date && (
            <span title={moment(commit.date).format('YYYY-MM-DD HH:mm:ss')}>
              · {merged ? 'merged' : 'committed'} {moment(commit.date).fromNow()}
            </span>
          )}
          <span>· not deployed yet. Deploy now?</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Deploy site={site} />
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setDismissedCommit(commitId)} aria-label="Dismiss new commit notice" title="Not now">
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
