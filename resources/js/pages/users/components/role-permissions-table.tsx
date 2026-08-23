import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, XIcon, ShieldCheckIcon, ChevronDownIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface PermissionRow {
  area: string;
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
    area: 'Admin Panel',
    admin: { allowed: true, label: 'Full' },
    user: { allowed: false, label: 'No' },
  },
  {
    area: 'User Management',
    admin: { allowed: true, label: 'Full' },
    user: { allowed: false, label: 'No' },
  },
  {
    area: 'Plugins',
    admin: { allowed: true, label: 'Full' },
    user: { allowed: false, label: 'No' },
  },
  {
    area: 'Settings',
    admin: { allowed: true, label: 'Full' },
    user: { allowed: false, label: 'No' },
  },
  {
    area: 'Projects',
    admin: { allowed: true, label: 'All' },
    user: { allowed: true, label: 'Assigned' },
  },
  {
    area: 'Servers & Sites',
    admin: { allowed: true, label: 'All' },
    user: { allowed: true, label: 'Assigned' },
  },
  {
    area: 'Credentials',
    admin: { allowed: true, label: 'All' },
    user: { allowed: true, label: 'Assigned' },
  },
];

export default function RolePermissionsTable() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="size-4 text-primary" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Role Permissions</span>
                <span className="text-xs text-muted-foreground">• Admin (Full) / User (Project)</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{isOpen ? 'Hide' : 'Details'}</span>
              <ChevronDownIcon
                className={cn('size-3.5 transition-transform duration-200', isOpen && 'rotate-180')}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-1/3 py-2 text-xs font-medium">Area</TableHead>
                  <TableHead className="w-1/3 py-2 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>Admin</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 font-normal">
                        Full
                      </Badge>
                    </div>
                  </TableHead>
                  <TableHead className="w-1/3 py-2 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>User</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        Project
                      </Badge>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((row) => (
                  <TableRow key={row.area} className="hover:bg-muted/20">
                    <TableCell className="py-2 text-xs font-medium text-foreground">
                      {row.area}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        {row.admin.allowed ? (
                          <CheckIcon className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XIcon className="size-3.5 text-destructive shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground">{row.admin.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        {row.user.allowed ? (
                          <CheckIcon className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XIcon className="size-3.5 text-destructive shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground">{row.user.label}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
