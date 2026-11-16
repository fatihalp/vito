import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import React, { useCallback, useState } from 'react';
import { useSocketListener } from '@/hooks/use-socket-events';
import { TableSkeleton } from '@/components/table-skeleton';
import { DataTable } from '@/components/data-table';
import { columns } from '@/pages/server-logs/components/columns';

export default function Logs({ server, site }: { server: Server; site?: Site }) {
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  useSocketListener(
    useCallback(
      (event) => {
        const data = event.data as { server_id?: number } | undefined;
        if (event.type?.startsWith('server-log.') && (data?.server_id === undefined || data.server_id === server.id)) {
          void queryClient.invalidateQueries({ queryKey: ['serverLogs', server.id] });
        }
      },
      [queryClient, server.id],
    ),
  );

  const query = useQuery({
    queryKey: ['serverLogs', server.id, site?.id, currentPage],
    queryFn: async () => {
      return (
        await axios.get(`/servers/${server.id}/logs/json${site ? `/${site.id}` : ''}`, {
          params: { page: currentPage },
        })
      ).data;
    },
    placeholderData: (prev) => prev,
  });

  return (
    <>
      {query.isError ? (
        <div role="alert" className="flex items-center gap-2 text-sm">
          <span>Unable to load server logs.</span>
          <button type="button" className="underline" onClick={() => void query.refetch()}>Try again</button>
        </div>
      ) : query.isLoading ? (
        <TableSkeleton rows={5} cells={3} />
      ) : (
        <DataTable
          columns={columns}
          paginatedData={query.data}
          onPageChange={setCurrentPage}
          isFetching={query.isFetching}
          isLoading={query.isLoading}
        />
      )}
    </>
  );
}
