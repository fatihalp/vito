import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Skeleton } from '@/components/ui/skeleton';
import CopyableField from '@/components/copyable-field';
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
        <div className="grid gap-2 p-4">
          {query.isSuccess ? (
            Object.entries(query.data).map(([key, value]) => (
              <CopyableField key={key} value={`${key}=${value}`} masked={key === 'AWS_SECRET_ACCESS_KEY'} />
            ))
          ) : query.isError ? (
            <p className="text-destructive text-sm">Failed to load credentials.</p>
          ) : (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
          )}
          <p className="text-muted-foreground text-sm">
            Anyone with these credentials has full read/write access to every bucket in this Hetzner project.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
