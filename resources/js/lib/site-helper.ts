import type { Site } from '@/types/site';

export type RecentSite = Pick<Site, 'id' | 'server_id'> & { last_used_at: number };

const currentSiteKey = 'site';
const recentSitesLimit = 25;
const recentHistoryTtl = 30 * 24 * 60 * 60 * 1000;

function recentSitesKey(userId: number, serverId: number): string {
  return `recent-sites:${userId}:${serverId}`;
}

function recentProjectSitesKey(userId: number, projectId: number): string {
  return `recent-project-sites:${userId}:${projectId}`;
}

function readRecentSites(key: string): RecentSite[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(key);

    const recentSites = stored ? (JSON.parse(stored) as RecentSite[]) : [];

    return recentSites.filter((site) => site.last_used_at >= Date.now() - recentHistoryTtl);
  } catch {
    return [];
  }
}

function writeRecentSites(key: string, sites: RecentSite[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(sites));
  } catch {
    return;
  }
}

const siteHelper = {
  getStoredSite() {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const storedSite = localStorage.getItem(currentSiteKey);

      return storedSite ? (JSON.parse(storedSite) as Site) : null;
    } catch {
      return null;
    }
  },
  storeSite(site?: Site, userId?: number, projectId?: number) {
    if (typeof window === 'undefined') {
      return;
    }

    if (!site) {
      try {
        localStorage.removeItem(currentSiteKey);
      } catch {
        return;
      }
      return;
    }

    try {
      localStorage.setItem(currentSiteKey, JSON.stringify(site));
    } catch {
      return;
    }

    if (userId && projectId) {
      const recentSite: RecentSite = {
        id: site.id,
        server_id: site.server_id,
        last_used_at: Date.now(),
      };
      const recentSites = readRecentSites(recentSitesKey(userId, site.server_id)).filter((item) => item.id !== site.id);
      writeRecentSites(recentSitesKey(userId, site.server_id), [recentSite, ...recentSites].slice(0, recentSitesLimit));
      const projectSites = readRecentSites(recentProjectSitesKey(userId, projectId)).filter((item) => item.id !== site.id);
      writeRecentSites(recentProjectSitesKey(userId, projectId), [recentSite, ...projectSites].slice(0, recentSitesLimit));
    }
  },
  getRecentSites(userId: number, serverId: number, limit = 5): RecentSite[] {
    return readRecentSites(recentSitesKey(userId, serverId)).slice(0, limit);
  },
  getRecentProjectSites(userId: number, projectId: number, limit = 3): RecentSite[] {
    return readRecentSites(recentProjectSitesKey(userId, projectId)).slice(0, limit);
  },
  removeRecentSite(userId: number, projectId: number, serverId: number, siteId: number): void {
    const recentSites = readRecentSites(recentSitesKey(userId, serverId)).filter((site) => site.id !== siteId);
    writeRecentSites(recentSitesKey(userId, serverId), recentSites);
    const projectSites = readRecentSites(recentProjectSitesKey(userId, projectId)).filter((site) => site.id !== siteId);
    writeRecentSites(recentProjectSitesKey(userId, projectId), projectSites);
  },
  removeRecentServerSites(userId: number, projectId: number, serverId: number): void {
    try {
      localStorage.removeItem(recentSitesKey(userId, serverId));
    } catch {
      return;
    }
    const projectSites = readRecentSites(recentProjectSitesKey(userId, projectId)).filter((site) => site.server_id !== serverId);
    writeRecentSites(recentProjectSitesKey(userId, projectId), projectSites);
  },
  clearRecentSites(userId: number): void {
    try {
      localStorage.removeItem(currentSiteKey);
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(`recent-sites:${userId}:`) || key?.startsWith(`recent-project-sites:${userId}:`)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      return;
    }
  },
};

export default siteHelper;
