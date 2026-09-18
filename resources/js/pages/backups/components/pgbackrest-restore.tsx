import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import CopyableField from '@/components/copyable-field';
import { Backup } from '@/types/backup';
import { BackupFile } from '@/types/backup-file';

function Commands({ commands }: { commands: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {commands.map((command) => (
        <CopyableField key={command} value={command} />
      ))}
    </div>
  );
}

export default function PgBackRestRestore({
  open,
  onOpenChange,
  backup,
  file,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backup: Backup;
  file?: BackupFile;
}) {
  const [target, setTarget] = useState('');
  const pointInTime = target.trim();

  const options = [
    `--stanza=${backup.pgbackrest?.stanza}`,
    '--delta',
    file && `--set=${file.name}`,
    pointInTime ? `--type=time "--target=${pointInTime}" --target-action=promote` : file && '--type=immediate --target-action=promote',
  ]
    .filter(Boolean)
    .join(' ');

  const restore = (extra: string) => [
    'sudo systemctl stop postgresql',
    `sudo -u postgres pgbackrest ${options}${extra} restore`,
    'sudo systemctl start postgresql',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Restore commands</DialogTitle>
          <DialogDescription>
            A restore replaces all data in the PostgreSQL cluster where you run it. Run these commands yourself over SSH.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pgbackrest-target">Point in time (optional)</Label>
            <Input id="pgbackrest-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="2026-09-17 14:30:00+00" />
            <p className="text-muted-foreground text-sm">
              {file
                ? `Leave empty to restore the database as it was when backup ${file.name} finished.`
                : 'Leave empty to restore the latest backup and replay all archived WAL up to the most recent change.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">On this server</h3>
            <Commands commands={restore('')} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">On another server</h3>
            <p className="text-muted-foreground text-sm">
              Use a server with PostgreSQL {file?.database_version ?? 'of the same major version'}. Install pgBackRest, copy /etc/pgbackrest/pgbackrest.conf from
              this server and set pg1-path to that server's data directory. --archive-mode=off stops the copy from archiving WAL into this backup's repository.
            </p>
            <Commands commands={restore(' --archive-mode=off')} />
          </div>
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
