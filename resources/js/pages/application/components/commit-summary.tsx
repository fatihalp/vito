import { useTranslate } from '@/hooks/use-translate';
import { GitPullRequestIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { parseCommitMessage, pullRequestUrl, safeUrl } from '@/lib/commit-message';
import { cn } from '@/lib/utils';
import { Deployment } from '@/types/deployment';

const TYPE_VARIANTS: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  feat: 'success',
  fix: 'warning',
  hotfix: 'danger',
  revert: 'danger',
  perf: 'info',
  refactor: 'info',
};

export default function CommitSummary({
  commit,
  showScope = true,
  className,
}: {
  commit: Deployment['commit_data'] | null | undefined;
  showScope?: boolean;
  className?: string;
}) {
  const translateText = useTranslate();
  if (!commit?.message) {
    return <span className={cn('text-muted-foreground', className)}>{translateText('No commit message')}</span>;
  }

  const parsed = parseCommitMessage(commit.message);
  const url = safeUrl(commit.url);
  const prUrl = parsed.pullRequest ? pullRequestUrl(url, parsed.pullRequest) : undefined;

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)} title={commit.message}>
      {parsed.type && (
        <Badge variant={TYPE_VARIANTS[parsed.type] ?? 'gray'} className="shrink-0 px-1.5 py-0 text-xs">
          {parsed.type}
          {parsed.breaking && '!'}
        </Badge>
      )}
      {showScope && parsed.scope && <span className="text-muted-foreground shrink-0">{parsed.scope}</span>}
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-foreground truncate font-medium hover:underline">
          {parsed.title}
        </a>
      ) : (
        <span className="text-foreground truncate font-medium">{parsed.title}</span>
      )}
      {parsed.pullRequest &&
        (prUrl ? (
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-0.5 tabular-nums hover:underline"
            title={translateText("Open pull request #:number", { number: parsed.pullRequest })}
          >
            <GitPullRequestIcon className="size-3.5" />#{parsed.pullRequest}
          </a>
        ) : (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-0.5 tabular-nums">
            <GitPullRequestIcon className="size-3.5" />#{parsed.pullRequest}
          </span>
        ))}
    </div>
  );
}
