import { ServerFeature } from '@/types/server';
import { SiteFeature } from '@/types/site';
import { Button } from '@/components/ui/button';
import { MoreVerticalIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardRow, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from '@inertiajs/react';

interface FeaturesCardProps {
  title?: string;
  description?: string;
  features: {
    [key: string]: ServerFeature | SiteFeature;
  };
  onActionSelect: (featureId: string, actionId: string, action: any) => void;
}

export default function FeaturesCard({ 
  title = "Features", 
  description = "Here you can see the list of features and their actions", 
  features, 
  onActionSelect 
}: FeaturesCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="space-y-2">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="bg-background">
        {Object.entries(features).length > 0 ? (
          Object.entries(features).map(([key, feature], index) => (
            <div key={`feature-${key}`}>
              <div className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <p>{feature.label}</p>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Actions
                      <MoreVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {Object.entries(feature.actions || {}).map(([actionKey, action]) => (
                      <DropdownMenuItem
                        key={`action-${actionKey}`}
                        disabled={!action.active}
                        onSelect={() => onActionSelect(key, actionKey, action)}
                      >
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {index < Object.entries(features).length - 1 && <Separator />}
            </div>
          ))
        ) : (
          <CardRow className="flex-col items-center justify-center space-y-2">
            <span className="text-muted-foreground">No available features</span>
            <Link href={route('plugins')} prefetch>
              <Button variant="outline">Explore Plugins</Button>
            </Link>
          </CardRow>
        )}
      </CardContent>
    </Card>
  );
}
