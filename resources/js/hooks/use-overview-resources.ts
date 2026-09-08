import { getQueryClient } from '@/lib/query-client';
import type { SharedData } from '@/types';
import type { Server, ServerWarning } from '@/types/server';
import type { Site, SiteWarning } from '@/types/site';
import { usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type OverviewServer = Pick<Server, 'id' | 'project_id' | 'name' | 'ip' | 'status' | 'status_color'> & {
  warnings: ServerWarning[];
};

export type OverviewSite = Pick<Site, 'id' | 'server_id' | 'domain' | 'status' | 'status_color'> & {
  server_name: string;
  warnings: SiteWarning[];
};

export type OverviewProject = {
  id: number;
  name: string;
  users_count: number;
  is_current: boolean;
};

export type OverviewProviderItem = {
  id: number;
  provider: string;
  profile: string;
  connected?: boolean;
};

export type OverviewBackup = {
  id: number;
  name: string;
  server_name?: string;
  interval?: string;
};

export type OverviewDomain = {
  id: number;
  domain: string;
  provider_name?: string;
};

export type OverviewResources = {
  servers: OverviewServer[];
  sites: OverviewSite[];
  projects?: OverviewProject[];
  server_providers?: OverviewProviderItem[];
  source_controls?: OverviewProviderItem[];
  storage_providers?: OverviewProviderItem[];
  dns_providers?: OverviewProviderItem[];
  backups?: OverviewBackup[];
  domains?: OverviewDomain[];
};

const emptyResources: OverviewResources = {
  servers: [],
  sites: [],
  projects: [],
  server_providers: [],
  source_controls: [],
  storage_providers: [],
  dns_providers: [],
  backups: [],
  domains: [],
};

export function useOverviewResources(
  projectId?: number | null,
  serverIds: number[] = [],
  siteIds: number[] = [],
  enabled = true,
  fallbackServerId?: number,
) {
  const { auth } = usePage<SharedData>().props;
  const query = useQuery(
    {
      queryKey: ['overview.resources', projectId ?? 'all', serverIds, siteIds, fallbackServerId],
      queryFn: async ({ signal }) => {
        const response = await axios.get<OverviewResources>(route('overview.resources'), {
          signal,
          params: { servers: serverIds, sites: siteIds, fallback_server_id: fallbackServerId },
        });
        return response.data;
      },
      enabled,
      staleTime: 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    getQueryClient(auth.user.id),
  );

  return {
    data: enabled ? query.data : emptyResources,
    isLoading: enabled && query.isLoading,
    isError: enabled && query.isError,
    refetch: async () => {
      if (enabled) {
        await query.refetch({ cancelRefetch: false });
      }
    },
  };
}
