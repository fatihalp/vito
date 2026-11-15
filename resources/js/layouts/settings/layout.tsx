import { type NavItem, SharedData } from '@/types';
import {
  ArrowLeftRightIcon,
  BellIcon,
  CloudIcon,
  CloudUploadIcon,
  CodeIcon,
  DatabaseIcon,
  GithubIcon,
  GlobeIcon,
  KeyIcon,
  NetworkIcon,
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
      title: 'GitHub App',
      href: "/admin/github-app",
      icon: GithubIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Pure Settings',
      href: "/admin/vito",
      icon: ShieldCheckIcon,
      hidden: !isAdmin,
    },
    {
      title: 'Environment key search',
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

