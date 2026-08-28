import { type NavItem, SharedData } from '@/types';
import {
  BellIcon,
  CloudIcon,
  CloudUploadIcon,
  CodeIcon,
  CommandIcon,
  DatabaseIcon,
  GithubIcon,
  GlobeIcon,
  KeyIcon,
  LogsIcon,
  NetworkIcon,
  PlugIcon,
  SearchIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from 'lucide-react';
import { ReactNode } from 'react';
import Layout from '@/layouts/app/layout';
import { usePage } from '@inertiajs/react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const page = usePage<SharedData>();
  const isAdmin = page.props.auth.user?.is_admin;

  if (typeof window === 'undefined') {
    return null;
  }

  const sidebarNavItems: NavItem[] = [
    {
      title: 'Server Providers',
      href: route('server-providers'),
      icon: CloudIcon,
    },
    {
      title: 'Source Controls',
      href: route('source-controls'),
      icon: CodeIcon,
    },
    {
      title: 'Storage Providers',
      href: route('storage-providers'),
      icon: DatabaseIcon,
    },
    {
      title: 'DNS Providers',
      href: route('dns-providers'),
      icon: GlobeIcon,
    },
    {
      title: 'Networks',
      href: route('networks'),
      icon: NetworkIcon,
    },
    {
      title: 'Notification Channels',
      href: route('notification-channels'),
      icon: BellIcon,
    },
    {
      title: 'SSH Keys',
      href: route('ssh-keys'),
      icon: KeyIcon,
    },
    {
      title: 'API Keys',
      href: route('api-keys'),
      icon: CommandIcon,
    },
    {
      title: 'Backups',
      href: route('backups.all'),
      icon: CloudUploadIcon,
    },
    {
      title: 'Workflows',
      href: route('workflows'),
      icon: WorkflowIcon,
    },
    {
      title: 'Domains',
      href: route('domains'),
      icon: GlobeIcon,
    },
    {
      title: 'Plugins',
      href: route('plugins'),
      icon: PlugIcon,
      hidden: !isAdmin,
    },
    {
      title: 'GitHub App',
      href: route('github-app'),
      icon: GithubIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Vito Settings',
      href: route('vito-settings'),
      icon: ShieldCheckIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Env Anahtarı Ara',
      href: route('env-search'),
      icon: SearchIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Logs',
      href: route('log-viewer.index'),
      icon: LogsIcon,
      external: true,
      hidden: !isAdmin,
    },
  ];

  return (
    <Layout secondNavItems={sidebarNavItems} secondNavTitle="Settings">
      {children}
    </Layout>
  );
}

