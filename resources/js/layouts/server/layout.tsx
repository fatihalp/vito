import { type NavItem } from '@/types';
import {
  ArrowUpCircleIcon,
  CopyIcon,
  BoxIcon,
  ChartLineIcon,
  ClockIcon,
  CloudIcon,
  CloudUploadIcon,
  CogIcon,
  CpuIcon,
  DatabaseIcon,
  FlameIcon,
  HardDriveIcon,
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
  SlidersIcon,
  TerminalIcon,
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

    const serverPath = `/servers/${server.id}`;

    return router.on('before', (event) => {
      const { method, url } = event.detail.visit;
      if (method === 'get' || (url.pathname !== serverPath && !url.pathname.startsWith(`${serverPath}/`))) return;

      const action = url.pathname.slice(serverPath.length);
      if (
        (method === 'delete' && (action === '' || action === '/')) ||
        ['/switch', '/status', '/start', '/settings/update', '/transfer'].includes(action) ||
        /^\/sites\/\d+\/switch$/.test(action)
      ) {
        return;
      }

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
  const services = page.props.server?.services ?? {};

  const sidebarNavItems: NavItem[] = [
    {
      title: 'Overview',
      href: `/servers/${serverId}`,
      onlyActivePath: `/servers/${serverId}`,
      icon: HomeIcon,
    },
    {
      title: server.counts?.sites !== undefined ? `Sites (${server.counts.sites})` : 'Sites',
      href: `/servers/${serverId}/sites`,
      onlyActivePath: `/servers/${serverId}/sites`,
      icon: MousePointerClickIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['webserver'],
      flyoutContent: <RecentSitesFlyout server={server} />,
    },
    {
      title: server.counts?.databases !== undefined ? `Databases (${server.counts.databases})` : 'Databases',
      href: `/servers/${serverId}/database`,
      icon: DatabaseIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['database'],
      children: [
        {
          title: server.counts?.databases !== undefined ? `Databases (${server.counts.databases})` : 'Databases',
          href: `/servers/${serverId}/database`,
          onlyActivePath: `/servers/${serverId}/database`,
          icon: DatabaseIcon,
        },
        {
          title: server.counts?.database_users !== undefined ? `Database users (${server.counts.database_users})` : 'Database users',
          href: `/servers/${serverId}/database/users`,
          icon: UsersIcon,
        },
        {
          title: 'Replication',
          href: `/servers/${serverId}/database-replicas`,
          icon: CopyIcon,
          hidden: services['database'] !== 'postgresql',
        },
        {
          title: 'Version upgrade',
          href: `/servers/${serverId}/database-upgrades`,
          icon: ArrowUpCircleIcon,
          hidden: services['database'] !== 'postgresql',
        },
      ],
    },
    {
      title: server.counts?.cronjobs !== undefined ? `CronJobs (${server.counts.cronjobs})` : 'CronJobs',
      href: `/servers/${serverId}/cronjobs`,
      onlyActivePath: `/servers/${serverId}/cronjobs`,
      icon: ClockIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: server.counts?.workers !== undefined ? `Workers (${server.counts.workers})` : 'Workers',
      href: `/servers/${serverId}/workers`,
      onlyActivePath: `/servers/${serverId}/workers`,
      icon: ListEndIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['process_manager'],
    },
    {
      title: server.counts?.services !== undefined ? `Services (${server.counts.services})` : 'Services',
      href: `/servers/${serverId}/services`,
      onlyActivePath: `/servers/${serverId}/services`,
      icon: CogIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: server.counts?.backups !== undefined ? `Backups (${server.counts.backups})` : 'Backups',
      href: `/servers/${serverId}/backups`,
      onlyActivePath: `/servers/${serverId}/backups`,
      icon: CloudUploadIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Security',
      href: `/servers/${serverId}/security`,
      icon: ShieldIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Hardening',
          href: `/servers/${serverId}/security`,
          onlyActivePath: `/servers/${serverId}/security`,
          icon: ShieldIcon,
        },
        {
          title: 'Firewall',
          href: `/servers/${serverId}/firewall`,
          onlyActivePath: `/servers/${serverId}/firewall`,
          icon: FlameIcon,
          hidden: !services['firewall'],
        },
        {
          title: 'SSH Keys',
          href: `/servers/${serverId}/ssh-keys`,
          icon: KeyIcon,
        },
        {
          title: 'SSL',
          href: `/servers/${serverId}/ssl`,
          icon: LockIcon,
        },
      ],
    },
    {
      title: 'System',
      href: `/servers/${serverId}/network`,
      icon: NetworkIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Network',
          href: `/servers/${serverId}/network`,
          onlyActivePath: `/servers/${serverId}/network`,
          icon: NetworkIcon,
        },
        {
          title: 'Features',
          href: `/servers/${serverId}/features`,
          onlyActivePath: `/servers/${serverId}/features`,
          icon: BoxIcon,
        },
        {
          title: 'Limits',
          href: `/servers/${serverId}/limits`,
          onlyActivePath: `/servers/${serverId}/limits`,
          icon: SlidersIcon,
        },
      ],
    },
    {
      title: 'Monitor & Logs',
      href: `/servers/${serverId}/monitoring`,
      icon: ChartLineIcon,
      children: [
        {
          title: 'Metrics',
          href: `/servers/${serverId}/monitoring`,
          onlyActivePath: `/servers/${serverId}/monitoring`,
          icon: ChartLineIcon,
        },
        {
          title: 'Vito Events',
          href: `/servers/${serverId}/logs`,
          onlyActivePath: `/servers/${serverId}/logs`,
          icon: LogsIcon,
        },
        {
          title: 'Service logs',
          href: `/servers/${serverId}/logs/services`,
          onlyActivePath: `/servers/${serverId}/logs/services`,
          icon: ScrollTextIcon,
        },
        {
          title: 'Command History',
          href: `/servers/${serverId}/commands`,
          onlyActivePath: `/servers/${serverId}/commands`,
          icon: TerminalIcon,
        },
        {
          title: 'Custom logs',
          href: `/servers/${serverId}/logs/remote`,
          onlyActivePath: `/servers/${serverId}/logs/remote`,
          icon: CloudIcon,
        },
        {
          title: 'Processes',
          href: `/servers/${serverId}/monitoring/processes`,
          onlyActivePath: `/servers/${serverId}/monitoring/processes`,
          icon: CpuIcon,
        },
        {
          title: 'Server Information',
          href: `/servers/${serverId}/monitoring/information`,
          onlyActivePath: `/servers/${serverId}/monitoring/information`,
          icon: InfoIcon,
        },
        {
          title: 'Log Rotation',
          href: `/servers/${serverId}/monitoring/log-rotation`,
          onlyActivePath: `/servers/${serverId}/monitoring/log-rotation`,
          icon: RotateCcwIcon,
        },
        {
          title: 'Disk Usage',
          href: `/servers/${serverId}/monitoring/disk-usage`,
          onlyActivePath: `/servers/${serverId}/monitoring/disk-usage`,
          icon: HardDriveIcon,
        },
      ],
    },
    {
      title: 'Settings',
      href: `/servers/${serverId}/settings`,
      icon: Settings2Icon,
    },
  ];

  const viewingSite = !!page.props.site;
  const isRestartPage = page.url.split('?')[0].endsWith('/restart');
  const isOverviewPage = page.component === 'servers/show' || page.url.split('?')[0] === `/servers/${serverId}`;

  return (
    <Layout
      secondNavGroups={viewingSite ? [] : [{ title: '', items: sidebarNavItems }]}
      secondNavTitle={viewingSite ? undefined : server.name}
      secondNavSubtitle={viewingSite ? undefined : 'Server'}
      defaultPrimaryNavOpen={false}
    >
      {!viewingSite && <ServerHeader server={server} />}

      {isOffline && !isRestartPage && !isOverviewPage && (
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

      <div className="min-w-0 w-full">{children}</div>
    </Layout>
  );
}
