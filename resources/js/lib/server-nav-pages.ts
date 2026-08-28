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
  type LucideIcon,
} from 'lucide-react';

export type ServerNavPage = { key: string; label: string; routeName: string; icon: LucideIcon };

export const SERVER_NAV_PAGES: ServerNavPage[] = [
  { key: 'Sites', label: 'Sites', routeName: 'sites', icon: MousePointerClickIcon },
  { key: 'Databases', label: 'Databases', routeName: 'databases', icon: DatabaseIcon },
  { key: 'Database users', label: 'Database users', routeName: 'database-users', icon: UsersIcon },
  { key: 'CronJobs', label: 'CronJobs', routeName: 'cronjobs', icon: ClockIcon },
  { key: 'Workers', label: 'Workers', routeName: 'workers', icon: ListEndIcon },
  { key: 'Services', label: 'Services', routeName: 'services', icon: CogIcon },
  { key: 'Backups', label: 'Backups', routeName: 'backups', icon: CloudUploadIcon },
  { key: 'Hardening', label: 'Hardening', routeName: 'security', icon: ShieldIcon },
  { key: 'Firewall', label: 'Firewall', routeName: 'firewall', icon: FlameIcon },
  { key: 'SSH Keys', label: 'SSH Keys', routeName: 'server-ssh-keys', icon: KeyIcon },
  { key: 'SSL', label: 'SSL', routeName: 'server-ssls', icon: LockIcon },
  { key: 'Network', label: 'Network', routeName: 'servers.network', icon: NetworkIcon },
  { key: 'Features', label: 'Features', routeName: 'server-features', icon: BoxIcon },
  { key: 'Metrics', label: 'Metrics', routeName: 'monitoring', icon: ChartLineIcon },
  { key: 'Server logs', label: 'Server logs', routeName: 'logs', icon: LogsIcon },
  { key: 'Service logs', label: 'Service logs', routeName: 'logs.services', icon: ScrollTextIcon },
  { key: 'Custom logs', label: 'Custom logs', routeName: 'logs.remote', icon: CloudIcon },
  { key: 'Processes', label: 'Processes', routeName: 'monitoring.processes', icon: CpuIcon },
  { key: 'Server Information', label: 'Server Information', routeName: 'monitoring.information', icon: InfoIcon },
  { key: 'Log Rotation', label: 'Log Rotation', routeName: 'monitoring.log-rotation', icon: RotateCcwIcon },
  { key: 'Settings', label: 'Settings', routeName: 'server-settings', icon: Settings2Icon },
];

export function findActiveServerNavPage(currentPath: string, serverId: number): ServerNavPage | undefined {
  const candidates = SERVER_NAV_PAGES.map((page) => ({
    page,
    path: new URL(route(page.routeName, { server: serverId }), 'http://localhost').pathname,
  }));

  const exact = candidates.find((candidate) => candidate.path === currentPath);
  if (exact) {
    return exact.page;
  }

  return candidates
    .filter((candidate) => currentPath.startsWith(`${candidate.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.page;
}
