import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CreateSite from '@/pages/sites/components/create-site';
import type { Server } from '@/types/server';
import type { SecurityScore } from '@/types/security';
import { CheckCircle2Icon, PlusIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServerSetupGuideProps {
  server: Server;
  securityScore?: SecurityScore;
}

export default function ServerSetupGuide({ server, securityScore }: ServerSetupGuideProps) {
  const storageKey = `vito_dismiss_setup_guide_${server.id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const hasSites = (server.counts?.sites ?? 0) > 0;
  const hasSshKeys = (server.ssh_keys?.length ?? 0) > 0;
  const scoreVal = securityScore?.score ?? 0;
  const isSecure = scoreVal >= 80;

  const completedCount = (hasSites ? 1 : 0) + (hasSshKeys ? 1 : 0) + (isSecure ? 1 : 0);

  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
    }
    setDismissed(true);
  };

  const missingLabels = (securityScore?.checks ?? [])
    .filter((c) => !c.passed)
    .map((c) => c.label)
    .slice(0, 2)
    .join(', ');

  const securityHint = missingLabels ? `Recommended: ${missingLabels}` : 'Standard security measures applied';

  return (
    <Card className="border-border/60 bg-card shadow-2xs overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Server setup</span>
          <span className="text-[11px] text-muted-foreground font-mono">
            {completedCount} of 3 completed
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Dismiss setup guide"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>

      <div className="divide-y divide-border/40">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {hasSites ? (
              <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <div className="size-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', hasSites && 'text-muted-foreground')}>
                {hasSites ? 'Site created' : 'Create a site'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {hasSites ? `${server.counts?.sites} site(s) active` : 'Deploy your first web project'}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {hasSites ? (
              <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
                <Link href={route('sites', { server: server.id })}>View</Link>
              </Button>
            ) : (
              <CreateSite server={server}>
                <Button size="sm" className="h-7 px-2.5 text-xs gap-1 cursor-pointer">
                  <PlusIcon className="size-3" />
                  <span>Create</span>
                </Button>
              </CreateSite>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {hasSshKeys ? (
              <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <div className="size-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', hasSshKeys && 'text-muted-foreground')}>
                {hasSshKeys ? 'SSH key deployed' : 'Add an SSH key'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {hasSshKeys ? `${server.ssh_keys?.length} key(s) installed` : 'Connect to the terminal without passwords'}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button variant={hasSshKeys ? 'ghost' : 'outline'} size="sm" asChild className="h-7 px-2 text-xs cursor-pointer">
              <Link href={route('server-ssh-keys', { server: server.id })}>
                {hasSshKeys ? 'View' : 'Add key'}
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            {isSecure ? (
              <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
            ) : (
              <div className="size-4 rounded-full border-2 border-amber-500/60 shrink-0" />
            )}
            <div className="min-w-0">
              <p className={cn('text-xs font-medium', isSecure && 'text-muted-foreground')}>
                {isSecure ? 'Server secured' : `Server security (${scoreVal}%)`}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {securityHint}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <Button variant={isSecure ? 'ghost' : 'outline'} size="sm" asChild className="h-7 px-2 text-xs cursor-pointer">
              <Link href={route('security', { server: server.id })}>
                {isSecure ? 'View' : 'Configure'}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
