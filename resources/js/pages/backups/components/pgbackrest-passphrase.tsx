import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LoaderCircleIcon } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import CopyableField from '@/components/copyable-field';
import { Backup } from '@/types/backup';

export default function PgBackRestPassphrase({ open, onOpenChange, backup }: { open: boolean; onOpenChange: (open: boolean) => void; backup: Backup }) {
  const [passphrase, setPassphrase] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    axios
      .get<{ passphrase: string }>(route('backups.passphrase', { server: backup.server_id, backup: backup.id }))
      .then(({ data }) => setPassphrase(data.passphrase))
      .catch(() => toast.error('Could not load the encryption passphrase.'));
  }, [open, backup.server_id, backup.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encryption passphrase</DialogTitle>
          <DialogDescription>
            pgBackRest encrypts these backups with this passphrase. Store it outside Vito and this server, for example in a password manager. Without it the
            backups in S3 can't be restored.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">{passphrase ? <CopyableField value={passphrase} masked /> : <LoaderCircleIcon className="text-muted-foreground animate-spin" />}</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
