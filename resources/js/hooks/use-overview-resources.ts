import type { Server, ServerWarning } from '@/types/server';
import type { Site, SiteWarning } from '@/types/site';
import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

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

const emptyResources: OverviewResources = { servers: [], sites: [] };
const cacheLifetime = 60_000;
const cache = new Map<string, { data: OverviewResources; expiresAt: number }>();
const pendingRequests = new Map<string, Promise<OverviewResources>>();

type ResourceState = {
  signature: string;
  data?: OverviewResources;
  isError: boolean;
};

function idsFromKey(key: string): number[] {
  return key === '' ? [] : key.split(',').map(Number);
}

function requestResources(signature: string, serverIdsKey: string, siteIdsKey: string, fallbackServerId?: number): Promise<OverviewResources> {
  const cached = cache.get(signature);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.data);
  }
  if (cached) {
    cache.delete(signature);
  }

  const pending = pendingRequests.get(signature);
  if (pending) {
    return pending;
  }

  const request = axios
    .get<OverviewResources>(route('overview.resources'), {
      params: {
        servers: idsFromKey(serverIdsKey),
        sites: idsFromKey(siteIdsKey),
        fallback_server_id: fallbackServerId,
      },
    })
    .then((response) => {
      cache.set(signature, { data: response.data, expiresAt: Date.now() + cacheLifetime });

      return response.data;
    })
    .finally(() => pendingRequests.delete(signature));

  pendingRequests.set(signature, request);

  return request;
}

export function useOverviewResources(
  projectId: number | undefined,
  serverIds: number[],
  siteIds: number[],
  enabled = true,
  fallbackServerId?: number,
) {
  const serverIdsKey = serverIds.join(',');
  const siteIdsKey = siteIds.join(',');
  const signature = `${projectId ?? ''}|${serverIdsKey}|${siteIdsKey}|${fallbackServerId ?? ''}`;
  const [state, setState] = useState<ResourceState>({ signature: '', isError: false });
  const requestId = useRef(0);

  const fetchResources = useCallback(async (force = false) => {
    const currentRequestId = ++requestId.current;

    if (!enabled || projectId === undefined) {
      setState({ signature, data: emptyResources, isError: false });
      return;
    }

    if (force) {
      cache.delete(signature);
    }

    setState((current) => (current.signature === signature ? { ...current, isError: false } : { signature, isError: false }));

    try {
      const data = await requestResources(signature, serverIdsKey, siteIdsKey, fallbackServerId);

      if (currentRequestId === requestId.current) {
        setState({ signature, data, isError: false });
      }
    } catch {
      if (currentRequestId === requestId.current) {
        setState({ signature, isError: true });
      }
    }
  }, [enabled, fallbackServerId, projectId, serverIdsKey, signature, siteIdsKey]);

  useEffect(() => {
    void fetchResources();

    return () => {
      requestId.current += 1;
    };
  }, [fetchResources]);

  return {
    data: state.signature === signature ? state.data : undefined,
    isLoading: enabled && projectId !== undefined && (state.signature !== signature || (!state.data && !state.isError)),
    isError: state.signature === signature && state.isError,
    refetch: () => fetchResources(true),
  };
}
