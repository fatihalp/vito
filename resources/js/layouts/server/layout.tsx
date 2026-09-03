import { type NavItem } from '@/types';
import {
  BoxIcon,
  ChartLineIcon,
  ClockIcon,
  CloudIcon,
  CloudUploadIcon,
  CogIcon,
  CpuIcon,
  DatabaseIcon,
  FlameIcon,
  HomeIcon,
  InfoIcon,
  KeyIcon,
  ListEndIcon,
  LockIcon,
  LogsIcon,
  MousePointerClickIcon,
  NetworkIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  Settings2Icon,
  ShieldIcon,
  UsersIcon,
  WifiOffIcon,
} from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { Server } from '@/types/server';
import ServerHeader from '@/pages/servers/components/header';
import Layout from '@/layouts/app/layout';
import { router, usePage } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Site } from '@/types/site';
import { useRealtimeRecord } from '@/hooks/use-socket-events';
import RecentSitesFlyout from '@/layouts/server/components/recent-sites-flyout';
import siteHelper from '@/lib/site-helper';
import serverHelper from '@/lib/server-helper';
import { findActiveServerNavPage } from '@/lib/server-nav-pages';
import { SharedData } from '@/types';

export default function ServerLayout({ children }: { children: ReactNode }) {
  const page = usePage<SharedData & {
    server: Server;
    site?: Site;
  }>();

  const server = useRealtimeRecord<Server>(page.props.server, 'server')!;
  const isOffline = server.status === 'disconnected';
  const isMenuDisabled = !['ready', 'updating', 'disconnected'].includes(server.status);

  useEffect(() => {
    if (!isOffline) return;

    const serverPath = new URL(route('servers.show', { server: server.id })).pathname;

    return router.on('before', (event) => {
      const { method, url } = event.detail.visit;
      if (method === 'get' || (url.pathname !== serverPath && !url.pathname.startsWith(`${serverPath}/`))) return;

      const action = url.pathname.slice(serverPath.length);
      if (['/switch', '/status', '/start'].includes(action) || /^\/sites\/\d+\/switch$/.test(action)) return;

      event.preventDefault();
      toast.warning('This server is offline. Saved data is available in read-only mode. Start or reconnect the server before making changes.');
    });
  }, [isOffline, server.id]);

  useEffect(() => {
    if (page.props.site && page.props.auth?.user?.id && server.project_id) {
      siteHelper.storeSite(page.props.site, page.props.auth.user.id, server.project_id);
    }
  }, [page.props.site, page.props.auth?.user?.id, server.project_id]);

  useEffect(() => {
    const userId = page.props.auth?.user?.id;
    if (page.props.site || !userId) {
      return;
    }

    const activePage = findActiveServerNavPage(page.url.split('?')[0], server.id);
    if (activePage) {
      serverHelper.recordVisitedServerPage(userId, server.id, activePage.key);
    }
  }, [page.url, page.props.site, page.props.auth?.user?.id, server.id]);

  if (typeof window === 'undefined') {
    return null;
  }

  const serverId = page.props.server.id;
  const services = page.props.server.services;

  const sidebarNavItems: NavItem[] = [
    {
      title: 'Overview',
      href: route('servers.show', { server: serverId }),
      onlyActivePath: route('servers.show', { server: serverId }),
      icon: HomeIcon,
    },
    {
      title: server.counts?.sites !== undefined ? `Sites (${server.counts.sites})` : 'Sites',
      href: route('sites', { server: serverId }),
      onlyActivePath: route('sites', { server: serverId }),
      icon: MousePointerClickIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['webserver'],
      flyoutContent: <RecentSitesFlyout server={server} />,
    },
    {
      title: server.counts?.databases !== undefined ? `Databases (${server.counts.databases})` : 'Databases',
      href: route('databases', { server: serverId }),
      icon: DatabaseIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['database'],
      children: [
        {
          title: server.counts?.databases !== undefined ? `Databases (${server.counts.databases})` : 'Databases',
          href: route('databases', { server: serverId }),
          onlyActivePath: route('databases', { server: serverId }),
          icon: DatabaseIcon,
        },
        {
          title: server.counts?.database_users !== undefined ? `Database users (${server.counts.database_users})` : 'Database users',
          href: route('database-users', { server: serverId }),
          icon: UsersIcon,
        },
      ],
    },
    {
      title: server.counts?.cronjobs !== undefined ? `CronJobs (${server.counts.cronjobs})` : 'CronJobs',
      href: route('cronjobs', { server: serverId }),
      onlyActivePath: route('cronjobs', { server: serverId }),
      icon: ClockIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: server.counts?.workers !== undefined ? `Workers (${server.counts.workers})` : 'Workers',
      href: route('workers', { server: serverId }),
      onlyActivePath: route('workers', { server: serverId }),
      icon: ListEndIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['process_manager'],
    },
    {
      title: server.counts?.services !== undefined ? `Services (${server.counts.services})` : 'Services',
      href: route('services', { server: serverId }),
      onlyActivePath: route('services', { server: serverId }),
      icon: CogIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: server.counts?.backups !== undefined ? `Backups (${server.counts.backups})` : 'Backups',
      href: route('backups', { server: serverId }),
      onlyActivePath: route('backups', { server: serverId }),
      icon: CloudUploadIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Security',
      href: route('security', { server: serverId }),
      icon: ShieldIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Hardening',
          href: route('security', { server: serverId }),
          onlyActivePath: route('security', { server: serverId }),
          icon: ShieldIcon,
        },
        {
          title: 'Firewall',
          href: route('firewall', { server: serverId }),
          onlyActivePath: route('firewall', { server: serverId }),
          icon: FlameIcon,
          hidden: !services['firewall'],
        },
        {
          title: 'SSH Keys',
          href: route('server-ssh-keys', { server: serverId }),
          icon: KeyIcon,
        },
        {
          title: 'SSL',
          href: route('server-ssls', { server: serverId }),
          icon: LockIcon,
        },
      ],
    },
    {
      title: 'System',
      href: route('servers.network', { server: serverId }),
      icon: NetworkIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Network',
          href: route('servers.network', { server: serverId }),
          onlyActivePath: route('servers.network', { server: serverId }),
          icon: NetworkIcon,
        },
        {
          title: 'Features',
          href: route('server-features', { server: serverId }),
          onlyActivePath: route('server-features', { server: serverId }),
          icon: BoxIcon,
        },
      ],
    },
    {
      title: 'Monitor & Logs',
      href: route('monitoring', { server: serverId }),
      icon: ChartLineIcon,
      children: [
        {
          title: 'Metrics',
          href: route('monitoring', { server: serverId }),
          onlyActivePath: route('monitoring', { server: serverId }),
          icon: ChartLineIcon,
        },
        {
          title: 'Server logs',
          href: route('logs', { server: serverId }),
          onlyActivePath: route('logs', { server: serverId }),
          icon: LogsIcon,
        },
        {
          title: 'Service logs',
          href: route('logs.services', { server: serverId }),
          onlyActivePath: route('logs.services', { server: serverId }),
          icon: ScrollTextIcon,
        },
        {
          title: 'Custom logs',
          href: route('logs.remote', { server: serverId }),
          onlyActivePath: route('logs.remote', { server: serverId }),
          icon: CloudIcon,
        },
        {
          title: 'Processes',
          href: route('monitoring.processes', { server: serverId }),
          onlyActivePath: route('monitoring.processes', { server: serverId }),
          icon: CpuIcon,
        },
        {
          title: 'Server Information',
          href: route('monitoring.information', { server: serverId }),
          onlyActivePath: route('monitoring.information', { server: serverId }),
          icon: InfoIcon,
        },
        {
          title: 'Log Rotation',
          href: route('monitoring.log-rotation', { server: serverId }),
          onlyActivePath: route('monitoring.log-rotation', { server: serverId }),
          icon: RotateCcwIcon,
        },
      ],
    },
    {
      title: 'Settings',
      href: route('server-settings', { server: serverId }),
      icon: Settings2Icon,
    },
  ];

  const viewingSite = !!page.props.site;

  return (
    <Layout
      secondNavGroups={viewingSite ? [] : [{ title: '', items: sidebarNavItems }]}
      secondNavTitle={viewingSite ? undefined : server.name}
      secondNavSubtitle={viewingSite ? undefined : 'Server'}
    >
      {!viewingSite && <ServerHeader server={server} />}

      {isOffline && (
        <div className="px-4 pt-4">
          <Alert>
            <WifiOffIcon />
            <AlertTitle>Server offline — read-only mode</AlertTitle>
            <AlertDescription>
              You can view saved data. Creating, editing and deleting are unavailable until the server reconnects. Live server data cannot be refreshed.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div>{children}</div>
    </Layout>
  );
}
