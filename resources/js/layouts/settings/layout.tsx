import { type NavItem, SharedData } from '@/types';
import {
  BellIcon,
  CloudIcon,
  CodeIcon,
  CommandIcon,
  DatabaseIcon,
  GithubIcon,
  GlobeIcon,
  KeyIcon,
  ListIcon,
  PlugIcon,
  SlidersHorizontalIcon,
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
      title: 'Projects',
      href: route('projects'),
      icon: ListIcon,
    },
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
      icon: SlidersHorizontalIcon,
      hidden: !isAdmin,
    },
  ];

  return (
    <Layout secondNavItems={sidebarNavItems} secondNavTitle="Settings">
      {children}
    </Layout>
  );
}
