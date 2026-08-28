import type { Server } from '@/types/server';

export type RecentServer = Pick<Server, 'id'> & { last_used_at: number };

const recentServersLimit = 25;
const recentHistoryTtl = 30 * 24 * 60 * 60 * 1000;
const serverPageVisitsLimit = 10;

type ServerPageVisit = { key: string; last_used_at: number };

function recentServersKey(userId: number, projectId: number): string {
  return `recent-servers:${userId}:${projectId}`;
}

function serverPageVisitsKey(userId: number, serverId: number): string {
  return `server-page-visits:${userId}:${serverId}`;
}

function readRecentServers(userId: number, projectId: number): RecentServer[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(recentServersKey(userId, projectId));

    const recentServers = stored ? (JSON.parse(stored) as RecentServer[]) : [];

    return recentServers.filter((server) => server.last_used_at >= Date.now() - recentHistoryTtl);
  } catch {
    return [];
  }
}

function writeRecentServers(userId: number, projectId: number, servers: RecentServer[]): void {
  try {
    localStorage.setItem(recentServersKey(userId, projectId), JSON.stringify(servers));
  } catch {
    return;
  }
}

const serverHelper = {
  storeServer(server: Server, userId: number): void {
    if (typeof window === 'undefined') {
      return;
    }

    const recentServer: RecentServer = {
      id: server.id,
      last_used_at: Date.now(),
    };
    const recentServers = readRecentServers(userId, server.project_id).filter((item) => item.id !== server.id);
    writeRecentServers(userId, server.project_id, [recentServer, ...recentServers].slice(0, recentServersLimit));
  },
  getRecentServers(userId: number, projectId: number, limit = 3): RecentServer[] {
    return readRecentServers(userId, projectId).slice(0, limit);
  },
  getAllRecentServers(userId: number, limit = 25): RecentServer[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const all: RecentServer[] = [];
      const seen = new Set<number>();
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(`recent-servers:${userId}:`)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const list = JSON.parse(stored) as RecentServer[];
            for (const item of list) {
              if (item.last_used_at >= Date.now() - recentHistoryTtl && !seen.has(item.id)) {
                seen.add(item.id);
                all.push(item);
              }
            }
          }
        }
      }
      return all.sort((a, b) => b.last_used_at - a.last_used_at).slice(0, limit);
    } catch {
      return [];
    }
  },
  removeRecentServer(userId: number, projectId: number, serverId: number): void {
    const recentServers = readRecentServers(userId, projectId).filter((server) => server.id !== serverId);
    writeRecentServers(userId, projectId, recentServers);
  },
  clearRecentServers(userId: number): void {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(`recent-servers:${userId}:`) || key?.startsWith(`server-page-visits:${userId}:`)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      return;
    }
  },
  recordVisitedServerPage(userId: number, serverId: number, pageKey: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const key = serverPageVisitsKey(userId, serverId);
      const stored = localStorage.getItem(key);
      const visits: ServerPageVisit[] = stored ? (JSON.parse(stored) as ServerPageVisit[]) : [];
      const next = [{ key: pageKey, last_used_at: Date.now() }, ...visits.filter((visit) => visit.key !== pageKey)].slice(
        0,
        serverPageVisitsLimit,
      );
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      return;
    }
  },
  getRecentVisitedServerPages(userId: number, serverId: number, limit = 3): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(serverPageVisitsKey(userId, serverId));
      const visits = stored ? (JSON.parse(stored) as ServerPageVisit[]) : [];

      return visits.slice(0, limit).map((visit) => visit.key);
    } catch {
      return [];
    }
  },
};

export default serverHelper;
