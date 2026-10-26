import { ReactNode, useEffect, useState } from 'react';
import moment from 'moment';
import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LogStep } from '@/lib/log';
import { Deployment } from '@/types/deployment';

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);

  return minutes ? `${minutes}m ${String(total % 60).padStart(2, '0')}s` : `${total}s`;
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, [enabled]);

  return now;
}

export default function DeploymentProgress({
  deployment,
  step,
  action,
}: {
  deployment: Deployment;
  step: LogStep | null;
  action?: ReactNode;
}) {
  const deploying = deployment.status === 'deploying';
  const failed = deployment.status === 'failed';
  const now = useNow(deploying);

  const steps = deployment.progress?.steps ?? [];
  const estimate = deployment.progress?.estimated_duration ?? null;
  const samples = deployment.progress?.samples ?? 0;
  const current = step ? steps.findLastIndex((s) => s.group === step.group && s.line <= step.line) : -1;

  const endedAt = deploying ? now : moment(deployment.finished_at ?? deployment.updated_at).valueOf();
  const elapsed = Math.max(0, (endedAt - moment(deployment.created_at).valueOf()) / 1000);
  const remaining = estimate !== null ? estimate - elapsed : null;

  let percent = 0;
  if (deployment.status === 'finished') {
    percent = 100;
  } else if (failed) {
    if (steps.length > 0 && current >= 0) {
      percent = Math.round(((current + 1) / steps.length) * 100);
    } else {
      percent = 0;
    }
  } else if (steps.length > 0) {
    if (current >= 0) {
      percent = Math.min(95, Math.max(5, Math.round(((current + 0.5) / steps.length) * 100)));
    } else if (estimate && estimate > 0) {
      percent = Math.min(25, Math.max(2, Math.round((elapsed / estimate) * 100)));
    } else {
      percent = 2;
    }
  } else if (estimate && estimate > 0) {
    percent = Math.min(95, Math.max(2, Math.round((elapsed / estimate) * 100)));
  }

  const title = deploying ? 'Deployment in progress' : failed ? 'Deployment failed' : 'Deployment finished';
  const Icon = deploying ? LoaderCircleIcon : failed ? XCircleIcon : CheckCircle2Icon;
  const iconClass = deploying ? 'text-warning animate-spin' : failed ? 'text-destructive' : 'text-success';

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`size-4 shrink-0 ${iconClass}`} />
            <span className="text-sm font-medium">{title}</span>
            {steps.length > 0 ? (
              current >= 0 ? (
                <Badge variant="outline">
                  {failed ? 'Failed at step' : 'Step'} {current + 1} of {steps.length}
                </Badge>
              ) : (
                deploying && <Badge variant="outline">Preparing ({steps.length} steps)</Badge>
              )
            ) : null}
          </div>
          {action}
        </div>

        <Progress value={percent} aria-label="Deployment progress" className={failed ? 'bg-destructive/20' : undefined} />

        {current >= 0 && steps[current] && (
          <code className="text-muted-foreground truncate font-mono text-xs" title={steps[current].command}>
            $ {steps[current].command}
          </code>
        )}

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span>
            {deploying ? 'Elapsed' : 'Took'} {formatDuration(elapsed)}
          </span>
          {deploying && remaining !== null && (
            <span className="text-foreground font-medium">
              {remaining > 0
                ? `~${formatDuration(remaining)} remaining`
                : `Taking longer than usual (+${formatDuration(Math.abs(remaining))})`}
            </span>
          )}
          {estimate !== null ? (
            <span>
              Usually takes ~{formatDuration(estimate)} (average of last {samples} deployment{samples === 1 ? '' : 's'})
            </span>
          ) : (
            deploying && <span>No previous deployments to estimate duration</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
