import type { Server, ServerWarning } from '@/types/server';
import type { Site, SiteWarning } from '@/types/site';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type OverviewServer = Pick<Server, 'id' | 'project_id' | 'name' | 'ip' | 'status' | 'status_color'> & {
  warnings: ServerWarning[];
};

export type OverviewSite = Pick<Site, 'id' | 'server_id' | 'domain' | 'status' | 'status_color'> & {
  server_name: string;
  warnings: SiteWarning[];
};

type OverviewResources = {
  servers: OverviewServer[];
  sites: OverviewSite[];
};

export function useOverviewResources(
  projectId: number | undefined,
  serverIds: number[],
  siteIds: number[],
  enabled = true,
  fallbackServerId?: number,
) {
  return useQuery<OverviewResources>({
    queryKey: ['overview-resources', projectId, serverIds, siteIds, fallbackServerId],
    queryFn: async () => {
      const response = await axios.get<OverviewResources>(route('overview.resources'), {
        params: { servers: serverIds, sites: siteIds, fallback_server_id: fallbackServerId },
      });

      return response.data;
    },
    enabled: enabled && projectId !== undefined,
    staleTime: 60_000,
  });
}
