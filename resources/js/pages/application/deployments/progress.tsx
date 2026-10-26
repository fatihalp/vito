import { ReactNode, useEffect, useState } from 'react';
import moment from 'moment';
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Clock3Icon,
  CopyIcon,
  HistoryIcon,
  LoaderCircleIcon,
  SparklesIcon,
  TimerIcon,
  XCircleIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LogStep } from '@/lib/log';
import { cn } from '@/lib/utils';
import { Deployment, DeploymentStep } from '@/types/deployment';
import { toast } from 'sonner';

export function getStepTitle(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return 'Run command';

  if (/^git\s+(checkout|pull|fetch|reset|clone)/i.test(trimmed)) {
    return 'Fetch & checkout repository';
  }
  if (/^git\s+/i.test(trimmed)) {
    return 'Git command';
  }

  if (/^composer\s+install/i.test(trimmed)) {
    return 'Install PHP dependencies (Composer)';
  }
  if (/^composer\s+update/i.test(trimmed)) {
    return 'Update PHP dependencies (Composer)';
  }
  if (/^composer\s+dump-autoload/i.test(trimmed)) {
    return 'Dump Composer autoload';
  }
  if (/^composer\s+/i.test(trimmed)) {
    return 'Run Composer command';
  }

  if (/^(npm|pnpm|yarn|bun)\s+(install|ci|add)/i.test(trimmed)) {
    return 'Install frontend packages';
  }
  if (/^(npm|pnpm|yarn|bun)\s+(run\s+)?build/i.test(trimmed)) {
    return 'Build frontend assets';
  }

  if (/^php\s+artisan\s+migrate/i.test(trimmed)) {
    return 'Run database migrations';
  }
  if (/^php\s+artisan\s+(optimize:clear|clear-compiled)/i.test(trimmed)) {
    return 'Clear application cache';
  }
  if (/^php\s+artisan\s+(optimize|config:cache|route:cache|view:cache|event:cache)/i.test(trimmed)) {
    return 'Cache configuration & optimize';
  }
  if (/^php\s+artisan\s+queue:restart/i.test(trimmed)) {
    return 'Restart background queue workers';
  }
  if (/^php\s+artisan\s+down/i.test(trimmed)) {
    return 'Enable maintenance mode';
  }
  if (/^php\s+artisan\s+up/i.test(trimmed)) {
    return 'Disable maintenance mode';
  }
  if (/^php\s+artisan\s+/i.test(trimmed)) {
    const match = trimmed.match(/^php\s+artisan\s+([a-z0-9:-]+)/i);
    return match ? `Artisan: ${match[1]}` : 'Run Artisan command';
  }

  if (/sudo\s+(systemctl|service)\s+(reload|restart)/i.test(trimmed)) {
    return 'Reload server service';
  }

  if (/^(chmod|chown)/i.test(trimmed)) {
    return 'Update file permissions';
  }
  if (/^mkdir/i.test(trimmed)) {
    return 'Create deployment directories';
  }
  if (/^cd\s+/i.test(trimmed)) {
    return 'Navigate to application directory';
  }

  if (/^echo\s+["'].*(completed|finished|successful).*["']/i.test(trimmed)) {
    return 'Finalize deployment';
  }
  if (/^echo\s+/i.test(trimmed)) {
    const match = trimmed.match(/^echo\s+["']?([^"'\n\r]+)["']?/i);
    return match ? match[1] : 'Output message';
  }

  const firstWord = trimmed.split(/\s+/)[0];
  return `Execute ${firstWord}`;
}

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

function getStepState(
  index: number,
  current: number,
  deploymentStatus: string,
): 'completed' | 'running' | 'failed' | 'pending' {
  if (deploymentStatus === 'finished') {
    return 'completed';
  }

  if (deploymentStatus === 'failed') {
    if (current >= 0) {
      if (index < current) return 'completed';
      if (index === current) return 'failed';
      return 'pending';
    }
    return index === 0 ? 'failed' : 'pending';
  }

  if (current >= 0) {
    if (index < current) return 'completed';
    if (index === current) return 'running';
    return 'pending';
  }

  return index === 0 ? 'running' : 'pending';
}

function StepRow({
  stepItem,
  index,
  total,
  state,
}: {
  stepItem: DeploymentStep;
  index: number;
  total: number;
  state: 'completed' | 'running' | 'failed' | 'pending';
}) {
  const [copied, setCopied] = useState(false);
  const isLast = index === total - 1;
  const title = getStepTitle(stepItem.command);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(stepItem.command)
      .then(() => {
        setCopied(true);
        toast.success('Command copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Failed to copy command'));
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg p-2.5 transition-colors',
        state === 'running' && 'bg-warning/10 border border-warning/30 shadow-xs',
        state === 'failed' && 'bg-destructive/10 border border-destructive/30',
        state === 'completed' && 'hover:bg-accent/40',
        state === 'pending' && 'opacity-60 hover:opacity-100 hover:bg-accent/20',
      )}
    >
      {!isLast && (
        <span
          className={cn(
            'absolute left-6.5 top-11 -bottom-2.5 w-0.5',
            state === 'completed' ? 'bg-success/50' : 'bg-border/60',
          )}
          aria-hidden="true"
        />
      )}

      <div
        className={cn(
          'size-8 rounded-full flex items-center justify-center shrink-0 z-10 font-mono text-xs font-semibold transition-all',
          state === 'completed' && 'bg-success/15 text-success border border-success/40',
          state === 'running' &&
            'bg-warning/20 text-warning border border-warning/60 ring-2 ring-warning/30 animate-pulse',
          state === 'failed' && 'bg-destructive/20 text-destructive border border-destructive/50',
          state === 'pending' && 'bg-muted text-muted-foreground border border-border',
        )}
      >
        {state === 'completed' ? (
          <CheckCircle2Icon className="size-4.5" />
        ) : state === 'running' ? (
          <LoaderCircleIcon className="size-4.5 animate-spin" />
        ) : state === 'failed' ? (
          <XCircleIcon className="size-4.5" />
        ) : (
          index + 1
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
            <span className="text-xs text-muted-foreground shrink-0">(Step {index + 1})</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {state === 'running' && (
              <Badge variant="warning" className="gap-1 animate-pulse text-[11px] py-0">
                <LoaderCircleIcon className="size-3 animate-spin" />
                Running
              </Badge>
            )}
            {state === 'completed' && (
              <Badge variant="outline" className="text-success border-success/40 bg-success/10 gap-1 text-[11px] py-0">
                <CheckCircle2Icon className="size-3" />
                Completed
              </Badge>
            )}
            {state === 'failed' && (
              <Badge variant="destructive" className="gap-1 text-[11px] py-0">
                <XCircleIcon className="size-3" />
                Failed
              </Badge>
            )}
            {state === 'pending' && <span className="text-xs text-muted-foreground">Queued</span>}

            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleCopy}
              title="Copy command"
            >
              {copied ? <CheckIcon className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
            </Button>
          </div>
        </div>

        <code className="text-muted-foreground text-xs font-mono break-all line-clamp-2 bg-background/60 rounded px-2 py-1 border border-border/40">
          $ {stepItem.command}
        </code>
      </div>
    </div>
  );
}

export default function DeploymentProgress({
  deployment,
  step,
  action,
  defaultShowSteps = false,
  className,
}: {
  deployment: Deployment;
  step: LogStep | null;
  action?: ReactNode;
  defaultShowSteps?: boolean;
  className?: string;
}) {
  const deploying = deployment.status === 'deploying';
  const failed = deployment.status === 'failed';
  const finished = deployment.status === 'finished';
  const now = useNow(deploying);

  const steps = deployment.progress?.steps ?? [];
  const estimate = deployment.progress?.estimated_duration ?? null;
  const samples = deployment.progress?.samples ?? 0;
  const current = step ? steps.findLastIndex((s) => s.group === step.group && s.line <= step.line) : -1;

  const endedAt = deploying ? now : moment(deployment.finished_at ?? deployment.updated_at).valueOf();
  const elapsed = Math.max(0, (endedAt - moment(deployment.created_at).valueOf()) / 1000);
  const remaining = estimate !== null ? estimate - elapsed : null;

  const [showSteps, setShowSteps] = useState(defaultShowSteps);

  let percent = 0;
  if (finished) {
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

  const title = deploying ? 'Deployment in Progress' : failed ? 'Deployment Failed' : 'Deployment Finished';
  const Icon = deploying ? LoaderCircleIcon : failed ? XCircleIcon : CheckCircle2Icon;
  const iconClass = deploying ? 'text-warning animate-spin' : failed ? 'text-destructive' : 'text-success';

  const activeStep = current >= 0 && steps[current] ? steps[current] : steps.length > 0 ? steps[0] : null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={cn(
                'size-8 rounded-full flex items-center justify-center shrink-0 border',
                deploying && 'bg-warning/15 border-warning/40 text-warning',
                finished && 'bg-success/15 border-success/40 text-success',
                failed && 'bg-destructive/15 border-destructive/40 text-destructive',
              )}
            >
              <Icon className={cn('size-4.5 shrink-0', iconClass)} />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold tracking-tight">{title}</span>
                {steps.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {finished
                      ? `All ${steps.length} steps completed`
                      : failed
                        ? `Failed at step ${Math.max(1, current + 1)} of ${steps.length}`
                        : current >= 0
                          ? `Step ${current + 1} of ${steps.length}`
                          : `Preparing (${steps.length} steps)`}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {steps.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 cursor-pointer"
                onClick={() => setShowSteps((prev) => !prev)}
              >
                <span>{showSteps ? 'Hide steps' : `View all steps (${steps.length})`}</span>
                {showSteps ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
              </Button>
            )}
            {action}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Progress</span>
            <span className="font-semibold text-foreground">{percent}%</span>
          </div>
          <Progress
            value={percent}
            aria-label="Deployment progress"
            className={cn(
              'h-2.5',
              failed && 'bg-destructive/20 [&>[data-slot=progress-indicator]]:bg-destructive',
              deploying && 'bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning',
              finished && 'bg-success/20 [&>[data-slot=progress-indicator]]:bg-success',
            )}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3Icon className="size-3.5" />
              <span>{deploying ? 'Elapsed Time' : 'Total Duration'}</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {formatDuration(elapsed)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TimerIcon className={cn('size-3.5', deploying && 'text-warning')} />
              <span>{deploying ? 'Est. Remaining' : 'Status'}</span>
            </div>
            <span
              className={cn(
                'text-sm font-semibold tracking-tight',
                deploying ? 'text-warning' : failed ? 'text-destructive' : 'text-success',
              )}
            >
              {deploying
                ? remaining !== null
                  ? remaining > 0
                    ? `~${formatDuration(remaining)}`
                    : `+${formatDuration(Math.abs(remaining))} over`
                  : 'Estimating...'
                : failed
                  ? 'Failed'
                  : 'Completed'}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <HistoryIcon className="size-3.5" />
              <span>Avg. Benchmark</span>
            </div>
            <span
              className="text-sm font-semibold tracking-tight text-foreground"
              title={samples > 0 ? `Based on last ${samples} successful deployments` : undefined}
            >
              {estimate !== null ? `~${formatDuration(estimate)}` : 'No history'}
              {samples > 0 && <span className="text-[11px] font-normal text-muted-foreground ml-1">({samples})</span>}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SparklesIcon className="size-3.5" />
              <span>Progress</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {percent}%
            </span>
          </div>
        </div>

        {steps.length > 0 && !showSteps && activeStep && (
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-muted/30 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold shrink-0">
                {failed ? 'Failed at:' : deploying ? 'Active Step:' : 'Latest Step:'}
              </span>
              <span className="font-medium text-foreground truncate">{getStepTitle(activeStep.command)}</span>
              <span className="text-muted-foreground font-mono truncate hidden sm:inline">
                ({activeStep.command})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 shrink-0 cursor-pointer"
              onClick={() => setShowSteps(true)}
            >
              <span>View steps</span>
              <ChevronDownIcon className="size-3.5" />
            </Button>
          </div>
        )}

        {steps.length > 0 && showSteps && (
          <div className="flex flex-col gap-2 pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                Deployment Pipeline ({steps.length} Steps)
              </span>
              <span>
                {finished
                  ? 'All steps completed'
                  : current >= 0
                    ? `Executing step ${current + 1} of ${steps.length}`
                    : 'Starting execution...'}
              </span>
            </div>

            <div className="relative flex flex-col gap-1">
              {steps.map((stepItem, index) => (
                <StepRow
                  key={`${stepItem.group}-${stepItem.line}-${index}`}
                  stepItem={stepItem}
                  index={index}
                  total={steps.length}
                  state={getStepState(index, current, deployment.status)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
