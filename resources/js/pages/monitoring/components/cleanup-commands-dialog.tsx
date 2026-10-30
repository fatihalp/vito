import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CopyIcon, TerminalIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type CleanupCommandsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: string;
  selectedBytes: number;
};

function formatBytes(b: number): string {
  if (b <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), units.length - 1);
  return `${(b / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function CleanupCommandsDialog({ open, onOpenChange, commands, selectedBytes }: CleanupCommandsDialogProps) {
  const [copied, setCopied] = useState(false);

  const copyCommands = () => {
    navigator.clipboard
      .writeText(commands)
      .then(() => {
        setCopied(true);
        toast.success('Commands copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-muted p-1.5 text-muted-foreground">
              <TerminalIcon className="size-5" />
            </div>
            <div>
              <DialogTitle>Cleanup Commands{selectedBytes > 0 ? ` (${formatBytes(selectedBytes)})` : ''}</DialogTitle>
              <DialogDescription className="mt-1">
                Run these commands on the server over SSH. Review them carefully before running, as these deletions cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative">
          <pre className="bg-muted/70 max-h-[60vh] overflow-auto rounded-md border p-4 font-mono text-xs whitespace-pre-wrap break-all">
            {commands || '# No commands to run'}
          </pre>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={copyCommands} disabled={!commands}>
            {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
            <span>{copied ? 'Copied' : 'Copy Commands'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
