import { type NavItem } from '@/types';
import {
  BoxIcon,
  ChartLineIcon,
  ClockIcon,
  CloudIcon,
  CloudUploadIcon,
  CogIcon,
  DatabaseIcon,
  FlameIcon,
  HomeIcon,
  KeyIcon,
  ListEndIcon,
  LockIcon,
  LogsIcon,
  MousePointerClickIcon,
  NetworkIcon,
  Settings2Icon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';
import { ReactNode } from 'react';
import { Server } from '@/types/server';
import ServerHeader from '@/pages/servers/components/header';
import Layout from '@/layouts/app/layout';
import { usePage } from '@inertiajs/react';
import { Site } from '@/types/site';
import PHPIcon from '@/icons/php';
import { useRealtimeRecord } from '@/hooks/use-socket-events';

export default function ServerLayout({ children }: { children: ReactNode }) {
  const page = usePage<{
    server: Server;
    site?: Site;
  }>();

  const server = useRealtimeRecord<Server>(page.props.server, 'server')!;
  const isMenuDisabled = server.status !== 'ready';

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
      title: 'Sites',
      href: route('sites', { server: serverId }),
      onlyActivePath: route('sites', { server: serverId }),
      icon: MousePointerClickIcon,
      isDisabled: isMenuDisabled,
      hidden: !services['webserver'],
    },
    {
      title: 'Data',
      href: route('databases', { server: serverId }),
      icon: DatabaseIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Databases',
          href: route('databases', { server: serverId }),
          onlyActivePath: route('databases', { server: serverId }),
          icon: DatabaseIcon,
          hidden: !services['database'],
        },
        {
          title: 'Database users',
          href: route('database-users', { server: serverId }),
          icon: UsersIcon,
          hidden: !services['database'],
        },
        {
          title: 'Backups',
          href: route('backups', { server: serverId }),
          icon: CloudUploadIcon,
        },
      ],
    },
    {
      title: 'Automation',
      href: route('cronjobs', { server: serverId }),
      icon: ClockIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'CronJobs',
          href: route('cronjobs', { server: serverId }),
          icon: ClockIcon,
        },
        {
          title: 'Workers',
          href: route('workers', { server: serverId }),
          icon: ListEndIcon,
          hidden: !services['process_manager'],
        },
      ],
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
      href: route('services', { server: serverId }),
      icon: CogIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Services',
          href: route('services', { server: serverId }),
          onlyActivePath: route('services', { server: serverId }),
          icon: CogIcon,
        },
        {
          title: 'PHP',
          href: route('php', { server: serverId }),
          onlyActivePath: route('php', { server: serverId }),
          icon: PHPIcon,
          hidden: !services['php'],
        },
        {
          title: 'Network',
          href: route('servers.network', { server: serverId }),
          icon: NetworkIcon,
        },
        {
          title: 'Features',
          href: route('server-features', { server: serverId }),
          icon: BoxIcon,
        },
      ],
    },
    {
      title: 'Monitoring',
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
          icon: CogIcon,
        },
        {
          title: 'Custom logs',
          href: route('logs.remote', { server: serverId }),
          onlyActivePath: route('logs.remote', { server: serverId }),
          icon: CloudIcon,
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

      <div>{children}</div>
    </Layout>
  );
}
