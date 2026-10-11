import {
  ArrowUpCircleIcon,
  BoxIcon,
  ChartLineIcon,
  ClockIcon,
  CloudIcon,
  CloudUploadIcon,
  CogIcon,
  CopyIcon,
  CpuIcon,
  DatabaseIcon,
  FlameIcon,
  HardDriveIcon,
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
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export type ServerNavPage = { key: string; label: string; path: string; icon: LucideIcon };

export const SERVER_NAV_PAGES: ServerNavPage[] = [
  { key: 'Sites', label: 'Sites', path: '/sites', icon: MousePointerClickIcon },
  { key: 'Databases', label: 'Databases', path: '/database', icon: DatabaseIcon },
  { key: 'Database users', label: 'Database users', path: '/database/users', icon: UsersIcon },
  { key: 'Replication', label: 'Replication', path: '/database-replicas', icon: CopyIcon },
  { key: 'Version upgrade', label: 'Version upgrade', path: '/database-upgrades', icon: ArrowUpCircleIcon },
  { key: 'CronJobs', label: 'CronJobs', path: '/cronjobs', icon: ClockIcon },
  { key: 'Workers', label: 'Workers', path: '/workers', icon: ListEndIcon },
  { key: 'Services', label: 'Services', path: '/services', icon: CogIcon },
  { key: 'Backups', label: 'Backups', path: '/backups', icon: CloudUploadIcon },
  { key: 'Hardening', label: 'Hardening', path: '/security', icon: ShieldIcon },
  { key: 'Firewall', label: 'Firewall', path: '/firewall', icon: FlameIcon },
  { key: 'SSH Keys', label: 'SSH Keys', path: '/ssh-keys', icon: KeyIcon },
  { key: 'SSL', label: 'SSL', path: '/ssl', icon: LockIcon },
  { key: 'Network', label: 'Network', path: '/network', icon: NetworkIcon },
  { key: 'Features', label: 'Features', path: '/features', icon: BoxIcon },
  { key: 'Limits', label: 'Limits', path: '/limits', icon: SlidersIcon },
  { key: 'Metrics', label: 'Metrics', path: '/monitoring', icon: ChartLineIcon },
  { key: 'Server logs', label: 'Vito Events', path: '/logs', icon: LogsIcon },
  { key: 'Service logs', label: 'Service logs', path: '/logs/services', icon: ScrollTextIcon },
  { key: 'Custom logs', label: 'Custom logs', path: '/logs/remote', icon: CloudIcon },
  { key: 'Processes', label: 'Processes', path: '/monitoring/processes', icon: CpuIcon },
  { key: 'Server Information', label: 'Server Information', path: '/monitoring/information', icon: InfoIcon },
  { key: 'Log Rotation', label: 'Log Rotation', path: '/monitoring/log-rotation', icon: RotateCcwIcon },
  { key: 'Disk Usage', label: 'Disk Usage', path: '/monitoring/disk-usage', icon: HardDriveIcon },
  { key: 'Settings', label: 'Settings', path: '/settings', icon: Settings2Icon },
];

export function findActiveServerNavPage(currentPath: string, serverId: number): ServerNavPage | undefined {
  const candidates = SERVER_NAV_PAGES.map((page) => ({
    page,
    path: `/servers/${serverId}${page.path}`,
  }));

  const exact = candidates.find((candidate) => candidate.path === currentPath);
  if (exact) {
    return exact.page;
  }

  return candidates
    .filter((candidate) => currentPath.startsWith(`${candidate.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.page;
}
