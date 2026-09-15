import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Server } from '@/types/server';
import type { SecurityScore } from '@/types/security';
import { CheckCircle2Icon, XIcon } from 'lucide-react';
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
  const isSecure = (securityScore?.checks?.length ?? 0) > 0 && (securityScore?.checks?.every((c) => c.passed) ?? scoreVal >= 80);

  const completedCount = (hasSites ? 1 : 0) + (hasSshKeys ? 1 : 0) + (isSecure ? 1 : 0);

  if (dismissed || server.is_self || completedCount === 3) {
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
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">Server setup</CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {completedCount} of 3 completed
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Dismiss"
          aria-label="Dismiss setup checklist"
        >
          <XIcon className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <div className="hover:bg-muted/50 flex items-center justify-between gap-4 px-4 py-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {hasSites ? (
                <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', hasSites && 'text-muted-foreground line-through')}>
                  {hasSites ? 'Site created' : 'Create a site'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {hasSites ? `${server.counts?.sites} site(s) active` : 'Deploy your first web project'}
                </p>
              </div>
            </div>
            {!hasSites && (
              <div className="shrink-0">
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs cursor-pointer" asChild>
                  <Link href={route('sites.create', { server: server.id })}>
                    Create
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="hover:bg-muted/50 flex items-center justify-between gap-4 px-4 py-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {hasSshKeys ? (
                <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', hasSshKeys && 'text-muted-foreground line-through')}>
                  {hasSshKeys ? 'SSH key deployed' : 'Add an SSH key'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {hasSshKeys ? `${server.ssh_keys?.length} key(s) installed` : 'Connect to the terminal without passwords'}
                </p>
              </div>
            </div>
            {!hasSshKeys && (
              <div className="shrink-0">
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs cursor-pointer" asChild>
                  <Link href={route('server-ssh-keys', { server: server.id })}>
                    Add key
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="hover:bg-muted/50 flex items-center justify-between gap-4 px-4 py-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              {isSecure ? (
                <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <div className="size-4 rounded-full border-2 border-amber-500/60 shrink-0" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm font-medium', isSecure && 'text-muted-foreground line-through')}>
                  {isSecure ? 'Server secured' : `Server security (${scoreVal}%)`}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {securityHint}
                </p>
              </div>
            </div>
            {!isSecure && (
              <div className="shrink-0">
                <Button size="sm" variant="outline" className="h-7 px-3 text-xs cursor-pointer" asChild>
                  <Link href={route('security', { server: server.id })}>
                    Configure
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
