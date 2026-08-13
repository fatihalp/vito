import type { Server } from '@/types/server';

export type RecentServer = Pick<Server, 'id'> & { last_used_at: number };

const recentServersLimit = 25;
const recentHistoryTtl = 30 * 24 * 60 * 60 * 1000;

function recentServersKey(userId: number, projectId: number): string {
  return `recent-servers:${userId}:${projectId}`;
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
  removeRecentServer(userId: number, projectId: number, serverId: number): void {
    const recentServers = readRecentServers(userId, projectId).filter((server) => server.id !== serverId);
    writeRecentServers(userId, projectId, recentServers);
  },
  clearRecentServers(userId: number): void {
    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(`recent-servers:${userId}:`)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      return;
    }
  },
};

export default serverHelper;
