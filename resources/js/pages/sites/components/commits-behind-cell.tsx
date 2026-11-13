import axios from 'axios';
import { Link } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import { GitBranchIcon, LoaderCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type CommitsBehind = {
  branch: string;
  behind?: number | null;
  error?: string;
};

export default function CommitsBehindCell({ serverId, siteId }: { serverId: number; siteId: number }) {
  const query = useQuery({
    queryKey: ['siteCommitsBehind', siteId],
    queryFn: async () => (await axios.get<CommitsBehind | null>(`/servers/${serverId}/sites/${siteId}/commits-behind`)).data,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  if (query.isPending) {
    return (
      <Badge variant="gray">
        <LoaderCircleIcon className="size-3 animate-spin" />
        Checking
      </Badge>
    );
  }

  if (!query.data?.branch && !query.error) {
    return null;
  }

  const error = query.error ? ((axios.isAxiosError(query.error) && query.error.response?.data?.message) || query.error.message) : query.data?.error;
  const behind = query.data?.behind;

  const badge = error ? (
    <Badge variant="warning">Check failed</Badge>
  ) : behind === null || behind === undefined ? (
    <Badge variant="gray">Not deployed</Badge>
  ) : behind === 0 ? (
    <Badge variant="success">Up to date</Badge>
  ) : (
    <Badge variant="warning">{behind} behind</Badge>
  );

  const hint = error
    ? error
    : behind === null || behind === undefined
      ? 'No successful deployment yet.'
      : behind === 0
        ? `The deployed commit is the latest on ${query.data?.branch}.`
        : `${behind} new ${behind === 1 ? 'commit' : 'commits'} on ${query.data?.branch} since the last deployment.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={error ? '/settings/source-controls' : `/servers/${serverId}/sites/${siteId}`}
          className="flex min-w-0 items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          {badge}
          {query.data?.branch && (
            <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
              <GitBranchIcon className="size-3.5 shrink-0" />
              <span className="truncate">{query.data.branch}</span>
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}
