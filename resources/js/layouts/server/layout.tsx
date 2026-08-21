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

  const sidebarNavItems: NavItem[] = [
    {
      title: 'Overview',
      href: route('servers.show', { server: page.props.server.id }),
      onlyActivePath: route('servers.show', { server: page.props.server.id }),
      icon: HomeIcon,
    },
    {
      title: 'Database',
      href: route('databases', { server: page.props.server.id }),
      icon: DatabaseIcon,
      isDisabled: isMenuDisabled,
      hidden: !page.props.server.services['database'],
      children: [
        {
          title: 'Databases',
          href: route('databases', { server: page.props.server.id }),
          onlyActivePath: route('databases', { server: page.props.server.id }),
          icon: DatabaseIcon,
        },
        {
          title: 'Users',
          href: route('database-users', { server: page.props.server.id }),
          icon: UsersIcon,
        },
      ],
    },
    {
      title: 'Backups',
      href: route('backups', { server: page.props.server.id }),
      icon: CloudUploadIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Sites',
      href: route('sites', { server: page.props.server.id }),
      onlyActivePath: route('sites', { server: page.props.server.id }),
      icon: MousePointerClickIcon,
      isDisabled: isMenuDisabled,
      hidden: !page.props.server.services['webserver'],
    },
    {
      title: 'Security',
      href: route('security', { server: page.props.server.id }),
      icon: ShieldIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'General',
          href: route('security', { server: page.props.server.id }),
          onlyActivePath: route('security', { server: page.props.server.id }),
          icon: ShieldIcon,
        },
        {
          title: 'Firewall',
          href: route('firewall', { server: page.props.server.id }),
          onlyActivePath: route('firewall', { server: page.props.server.id }),
          icon: FlameIcon,
          hidden: !page.props.server.services['firewall'],
        },
      ],
    },
    {
      title: 'Network',
      href: route('servers.network', { server: page.props.server.id }),
      icon: NetworkIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'CronJobs',
      href: route('cronjobs', { server: page.props.server.id }),
      icon: ClockIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Workers',
      href: route('workers', { server: page.props.server.id }),
      icon: ListEndIcon,
      isDisabled: isMenuDisabled,
      hidden: !page.props.server.services['process_manager'],
    },
    {
      title: 'SSH Keys',
      href: route('server-ssh-keys', { server: page.props.server.id }),
      icon: KeyIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'SSL',
      href: route('server-ssls', { server: page.props.server.id }),
      icon: LockIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Services',
      href: route('services', { server: page.props.server.id }),
      icon: CogIcon,
      isDisabled: isMenuDisabled,
      children: [
        {
          title: 'Services',
          href: route('services', { server: page.props.server.id }),
          onlyActivePath: route('services', { server: page.props.server.id }),
          icon: CogIcon,
        },
        {
          title: 'PHP',
          href: route('php', { server: page.props.server.id }),
          onlyActivePath: route('php', { server: page.props.server.id }),
          icon: PHPIcon,
          hidden: !page.props.server.services['php'],
        },
      ],
    },
    {
      title: 'Monitoring',
      href: route('monitoring', { server: page.props.server.id }),
      icon: ChartLineIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Logs',
      href: route('logs', { server: page.props.server.id }),
      icon: LogsIcon,
      children: [
        {
          title: 'Server logs',
          href: route('logs', { server: page.props.server.id }),
          onlyActivePath: route('logs', { server: page.props.server.id }),
          icon: LogsIcon,
        },
        {
          title: 'Service logs',
          href: route('logs.services', { server: page.props.server.id }),
          onlyActivePath: route('logs.services', { server: page.props.server.id }),
          icon: CogIcon,
        },
        {
          title: 'Custom logs',
          href: route('logs.remote', { server: page.props.server.id }),
          onlyActivePath: route('logs.remote', { server: page.props.server.id }),
          icon: CloudIcon,
        },
      ],
    },
    {
      title: 'Features',
      href: route('server-features', { server: page.props.server.id }),
      icon: BoxIcon,
      isDisabled: isMenuDisabled,
    },
    {
      title: 'Settings',
      href: route('server-settings', { server: page.props.server.id }),
      icon: Settings2Icon,
    },
  ];

  return (
    <Layout
      secondNavGroups={[
        { title: '', items: sidebarNavItems },
      ]}
      secondNavTitle={server.name}
      secondNavSubtitle="Server"
    >
      <ServerHeader server={server} site={page.props.site} />

      <div>{children}</div>
    </Layout>
  );
}
