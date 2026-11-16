import { Card, CardContent } from '@/components/ui/card';

export default function RolePermissionsTable() {
  return (
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">System administrator</h3>
          <p className="text-muted-foreground text-xs">Manages all projects, users and system settings.</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Project access</h3>
          <p className="text-muted-foreground text-xs">Manages resources in assigned projects. Cannot manage system users or system settings.</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">Project owner</h3>
          <p className="text-muted-foreground text-xs">Includes project access and ownership permissions, such as removing project members and transferring servers.</p>
        </div>
      </CardContent>
    </Card>
  );
}
