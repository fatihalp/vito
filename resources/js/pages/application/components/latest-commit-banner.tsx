import { useTranslate } from '@/hooks/use-translate';
import { useState } from 'react';
import DateTime from '@/components/date-time';
import moment from 'moment';
import { AlertTriangleIcon, GitCommitHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const translateText = useTranslate();
  const [dismissedCommit, setDismissedCommit] = useState<string | null>(null);

  if (latestCommit?.error) {
    return (
      <div className="text-muted-foreground flex items-center gap-3 border-t py-2 pr-3 pl-16 text-xs">
        <AlertTriangleIcon className="text-warning size-4 shrink-0" />
        <span className="truncate" title={latestCommit.error}>
          {translateText('Could not check :branch for new commits: :error', { branch: site.branch ?? '', error: latestCommit.error })}
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
    <div className="bg-info/5 flex items-center gap-3 border-t py-2.5 pr-3 pl-16">
      <GitCommitHorizontalIcon className="text-info size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-info shrink-0 font-medium">{translateText('New commit on :branch', { branch: site.branch ?? '' })}</span>
          <CommitSummary commit={commit} />
        </div>
        {(commit.name || commit.date) && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[13px]">
            {commit.name && <span>{commit.name}</span>}
            {commit.name && commit.date && <span aria-hidden="true">·</span>}
            {commit.date && (
              <span title={moment(commit.date).format('YYYY-MM-DD HH:mm:ss')}>
                {translateText(merged ? 'Merged' : 'Committed')} <DateTime date={commit.date} relative />
              </span>
            )}
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" className="size-8" onClick={() => setDismissedCommit(commitId)} aria-label={translateText('Dismiss new commit notice')} title={translateText('Not now')}>
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}
