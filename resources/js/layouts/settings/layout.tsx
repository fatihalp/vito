import { type NavItem, SharedData } from '@/types';
import {
  ArrowLeftRightIcon,
  BellIcon,
  CloudIcon,
  CloudUploadIcon,
  CodeIcon,
  CommandIcon,
  DatabaseIcon,
  GithubIcon,
  GlobeIcon,
  KeyIcon,
  NetworkIcon,
  PlugIcon,
  SearchIcon,
  ShieldCheckIcon,
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
      href: "/settings/server-providers",
      icon: CloudIcon,
    },
    {
      title: 'Source Controls',
      href: "/settings/source-controls",
      icon: CodeIcon,
    },
    {
      title: 'Storage Providers',
      href: "/settings/storage-providers",
      icon: DatabaseIcon,
    },
    {
      title: 'DNS Providers',
      href: "/settings/dns-providers",
      icon: GlobeIcon,
    },
    {
      title: 'Networks',
      href: "/networks",
      icon: NetworkIcon,
    },
    {
      title: 'Notification Channels',
      href: "/settings/notification-channels",
      icon: BellIcon,
    },
    {
      title: 'SSH Keys',
      href: "/settings/ssh-keys",
      icon: KeyIcon,
    },
    {
      title: 'API Keys',
      href: "/settings/api-keys",
      icon: CommandIcon,
    },
    {
      title: 'Backups',
      href: "/backups",
      icon: CloudUploadIcon,
    },
    {
      title: 'Storage Migrations',
      href: "/storage-migrations",
      icon: ArrowLeftRightIcon,
    },
    {
      title: 'Domains',
      href: "/domains",
      icon: GlobeIcon,
    },
    {
      title: 'Plugins',
      href: "/admin/plugins",
      icon: PlugIcon,
      hidden: !isAdmin,
    },
    {
      title: 'GitHub App',
      href: "/admin/github-app",
      icon: GithubIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Vito Settings',
      href: "/admin/vito",
      icon: ShieldCheckIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Env Anahtarı Ara',
      href: "/settings/env-search",
      icon: SearchIcon,
      hidden: !isAdmin,
    },
  ];

  return (
    <Layout secondNavItems={sidebarNavItems} secondNavTitle="Settings">
      {children}
    </Layout>
  );
}

