import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangleIcon, LoaderCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
    return <LoaderCircleIcon className="text-muted-foreground size-3.5 animate-spin" aria-label="Checking commits" />;
  }

  const error = query.error ? (axios.isAxiosError(query.error) ? query.error.response?.data?.message : null) ?? query.error.message : query.data?.error;

  if (error) {
    return (
      <span className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs" title={error}>
        <AlertTriangleIcon className="text-warning size-3.5 shrink-0" />
        <span className="truncate">{error}</span>
      </span>
    );
  }

  if (!query.data) {
    return null;
  }

  const { branch, behind } = query.data;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-muted-foreground truncate font-mono text-xs" title={branch}>{branch}</span>
      {behind === null || behind === undefined ? (
        <Badge variant="outline">Not deployed</Badge>
      ) : behind === 0 ? (
        <Badge variant="success">Up to date</Badge>
      ) : (
        <Badge variant="warning">{behind} {behind === 1 ? 'commit' : 'commits'} behind</Badge>
      )}
    </div>
  );
}
