import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import ResourceCredentialsView from '@/components/resource-credentials-view';
import { Bucket } from '@/types/bucket';

type BucketCredentials = {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_DEFAULT_REGION: string;
  AWS_BUCKET: string;
  AWS_ENDPOINT: string;
  AWS_URL: string;
  AWS_USE_PATH_STYLE_ENDPOINT: string;
};

export default function RevealCredentialsDialog({
  open,
  onOpenChange,
  bucket,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: Bucket;
}) {
  const query = useQuery({
    queryKey: ['buckets.reveal', bucket.id],
    queryFn: async () => (await axios.get<BucketCredentials>(route('buckets.reveal', { bucket: bucket.id }))).data,
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bucket credentials</DialogTitle>
          <DialogDescription>Use these credentials to connect to [{bucket.name}] from other applications.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-4">
          {query.isSuccess ? (
            <ResourceCredentialsView
              environment={query.data}
              type="bucket"
            />
          ) : query.isError ? (
            <p className="text-destructive text-sm">Failed to load credentials.</p>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
