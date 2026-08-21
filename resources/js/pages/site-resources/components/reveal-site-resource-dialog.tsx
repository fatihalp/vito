import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import ResourceCredentialsView from '@/components/resource-credentials-view';
import { SiteResource } from '@/types/site-resource';

type ResourceRevealData = {
  type: string;
  target: string;
  environment: Record<string, string>;
};

export default function RevealSiteResourceDialog({
  open,
  onOpenChange,
  serverId,
  siteId,
  resource,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  siteId: number;
  resource: SiteResource;
}) {
  const query = useQuery({
    queryKey: ['site-resources.reveal', serverId, siteId, resource?.id],
    queryFn: async () => {
      const response = await axios.get<ResourceRevealData>(
        route('site-resources.reveal', { server: serverId, site: siteId, resource: resource.id }),
      );
      return response.data;
    },
    enabled: open && !!resource?.id,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const targetName = resource?.server?.name ?? resource?.bucket?.name ?? 'Resource';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{resource?.type} credentials</DialogTitle>
          <DialogDescription>
            Configured environment variables and credentials for <strong>{targetName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4">
          {query.isSuccess ? (
            <ResourceCredentialsView
              environment={query.data.environment}
              type={resource?.type_value}
            />
          ) : query.isError ? (
            <p className="text-destructive text-sm">Failed to load resource credentials.</p>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
