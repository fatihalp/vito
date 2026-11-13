import { useTranslate } from '@/hooks/use-translate';
import { Card, CardContent } from '@/components/ui/card';

export default function RolePermissionsTable() {
  const translateText = useTranslate();
  return (
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{translateText("System administrator")}</h3>
          <p className="text-muted-foreground text-xs">{translateText("Manages all projects, users and system settings.")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{translateText("Project access")}</h3>
          <p className="text-muted-foreground text-xs">{translateText("Manages resources in assigned projects. Cannot manage system users or system settings.")}</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{translateText("Project owner")}</h3>
          <p className="text-muted-foreground text-xs">{translateText("Includes project access and ownership permissions, such as removing project members and transferring servers.")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
