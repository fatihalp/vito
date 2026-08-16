import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, XIcon, ShieldCheckIcon } from 'lucide-react';

interface PermissionRow {
  area: string;
  description: string;
  admin: {
    allowed: boolean;
    label: string;
  };
  user: {
    allowed: boolean;
    label: string;
  };
}

const permissions: PermissionRow[] = [
  {
    area: 'Admin Panel (/admin/*)',
    description: 'Access to instance-level settings, user administration, and system controls',
    admin: {
      allowed: true,
      label: 'Full access',
    },
    user: {
      allowed: false,
      label: 'No access',
    },
  },
  {
    area: 'User Management',
    description: 'Create, update, delete users, and assign system roles',
    admin: {
      allowed: true,
      label: 'Full control',
    },
    user: {
      allowed: false,
      label: 'No access',
    },
  },
  {
    area: 'Plugins & System Integrations',
    description: 'Install and configure official/community plugins, GitHub App, and system providers',
    admin: {
      allowed: true,
      label: 'Full control',
    },
    user: {
      allowed: false,
      label: 'No access',
    },
  },
  {
    area: 'System Settings & Backups',
    description: 'Manage global instance configurations, auto-updates, and instance-wide backups',
    admin: {
      allowed: true,
      label: 'Full control',
    },
    user: {
      allowed: false,
      label: 'No access',
    },
  },
  {
    area: 'Projects Scope',
    description: 'Visibility and management of projects within Vito',
    admin: {
      allowed: true,
      label: 'All projects across instance',
    },
    user: {
      allowed: true,
      label: 'Assigned projects only',
    },
  },
  {
    area: 'Servers & Sites Management',
    description: 'Manage servers, deployments, databases, SSL certificates, cron jobs, and queues',
    admin: {
      allowed: true,
      label: 'All servers and sites',
    },
    user: {
      allowed: true,
      label: 'Only within assigned projects',
    },
  },
  {
    area: 'Credentials & API Keys',
    description: 'Create and manage SSH keys, API tokens, and deployment credentials',
    admin: {
      allowed: true,
      label: 'Global & personal credentials',
    },
    user: {
      allowed: true,
      label: 'Personal & project credentials',
    },
  },
];

export default function RolePermissionsTable() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="text-primary size-5" />
          <CardTitle>Role Permissions Matrix</CardTitle>
        </div>
        <CardDescription>
          Overview of permissions and capabilities comparing Admin and standard User roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Permission / Area</TableHead>
              <TableHead className="w-1/3">
                <div className="flex items-center gap-2">
                  <span>Admin</span>
                  <Badge variant="default">Full Access</Badge>
                </div>
              </TableHead>
              <TableHead className="w-1/3">
                <div className="flex items-center gap-2">
                  <span>User</span>
                  <Badge variant="outline">Project Scoped</Badge>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((row) => (
              <TableRow key={row.area}>
                <TableCell className="font-medium">
                  <div className="font-semibold text-foreground">{row.area}</div>
                  <div className="text-muted-foreground text-xs">{row.description}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.admin.allowed ? (
                      <CheckIcon className="text-success size-4 shrink-0" />
                    ) : (
                      <XIcon className="text-destructive size-4 shrink-0" />
                    )}
                    <span className="text-sm">{row.admin.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {row.user.allowed ? (
                      <CheckIcon className="text-success size-4 shrink-0" />
                    ) : (
                      <XIcon className="text-destructive size-4 shrink-0" />
                    )}
                    <span className="text-sm">{row.user.label}</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
