import { useState } from 'react';
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CopyableField({
  value,
  className,
  mono = true,
  masked = false,
}: {
  value: string;
  className?: string;
  mono?: boolean;
  masked?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!masked);

  const copy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  return (
    <div className={cn('bg-muted/50 flex items-center gap-1 rounded-md border py-1 pr-1 pl-3', className)}>
      <span className={cn('flex-1 truncate text-xs', mono && 'font-mono')}>{revealed ? value : '•'.repeat(Math.min(value.length, 32))}</span>
      {masked && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide value' : 'Show value'}
        >
          {revealed ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </Button>
      )}
      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={copy} aria-label="Copy">
        {copied ? <CheckIcon className="text-success size-3.5" /> : <CopyIcon className="size-3.5" />}
      </Button>
    </div>
  );
}
