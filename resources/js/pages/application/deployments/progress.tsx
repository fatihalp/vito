import { ReactNode, useEffect, useState } from 'react';
import moment from 'moment';
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleIcon,
  Clock3Icon,
  CopyIcon,
  LoaderCircleIcon,
  TimerIcon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useClipboard } from '@/hooks/use-clipboard';
import { LogStep } from '@/lib/log';
import { cn } from '@/lib/utils';
import { Deployment, DeploymentStep } from '@/types/deployment';

type StepState = 'completed' | 'running' | 'failed' | 'pending';

const STEP_RULES: Array<[RegExp, string | ((match: RegExpMatchArray) => string)]> = [
  [/^git\s+(checkout|pull|fetch|reset|clone)/i, 'Pull repository'],
  [/^git\s+/i, 'Git command'],
  [/^composer\s+install/i, 'Composer install'],
  [/^composer\s+update/i, 'Composer update'],
  [/^composer\s+dump-autoload/i, 'Dump autoload'],
  [/^composer\s+/i, 'Composer'],
  [/^(npm|pnpm|yarn|bun)\s+(install|ci|add)/i, 'Install packages'],
  [/^(npm|pnpm|yarn|bun)\s+(run\s+)?build/i, 'Build assets'],
  [/^php\s+artisan\s+vito\b/i, 'Update Vito'],
  [/^php\s+artisan\s+migrate/i, 'Run migrations'],
  [/^php\s+artisan\s+(optimize:clear|clear-compiled)/i, 'Clear cache'],
  [/^php\s+artisan\s+(optimize|config:cache|route:cache|view:cache|event:cache)/i, 'Optimize application'],
  [/^php\s+artisan\s+queue:restart/i, 'Restart queue'],
  [/^php\s+artisan\s+down/i, 'Maintenance mode on'],
  [/^php\s+artisan\s+up/i, 'Maintenance mode off'],
  [/^php\s+artisan\s+([a-z0-9:-]+)/i, (m) => `artisan ${m[1]}`],
  [/sudo\s+(systemctl|service)\s+(reload|restart)/i, 'Reload service'],
  [/^(chmod|chown)/i, 'Fix permissions'],
  [/^mkdir/i, 'Create directory'],
  [/^cd\s+/i, 'Change directory'],
  [/^echo\s+["']?([^"'\n\r]+)["']?/i, (m) => m[1]],
];

const STEP_DURATION_RULES: Array<[RegExp, number]> = [
  [/^php\s+artisan\s+vito\b/i, 45],
  [/^(npm|pnpm|yarn|bun)\s+(run\s+)?build/i, 40],
  [/^(npm|pnpm|yarn|bun)\s+(install|ci|add)/i, 25],
  [/^composer\s+(install|update)/i, 15],
  [/^git\s+(checkout|pull|fetch|clone)/i, 5],
];

export function getStepTitle(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return 'Command';

  for (const [pattern, label] of STEP_RULES) {
    const match = trimmed.match(pattern);
    if (match) {
      return typeof label === 'function' ? label(match) : label;
    }
  }

  return trimmed.split(/\s+/)[0];
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);

  return minutes ? `${minutes}m ${String(total % 60).padStart(2, '0')}s` : `${total}s`;
}

export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function estimateStepSeconds(command: string): number {
  const trimmed = command.trim();
  for (const [pattern, seconds] of STEP_DURATION_RULES) {
    if (pattern.test(trimmed)) {
      return seconds;
    }
  }

  return 5;
}

function calculateRemainingSeconds(
  steps: DeploymentStep[],
  current: number,
  elapsed: number,
  estimate: number | null,
): number {
  const activeIndex = Math.max(0, current);
  const remainingStepsEstimate =
    steps.length > 0
      ? steps.slice(activeIndex).reduce((sum, item) => sum + estimateStepSeconds(item.command), 0)
      : 20;

  const targetTotal = estimate && estimate > 0 ? estimate : Math.max(15, remainingStepsEstimate);

  if (elapsed < targetTotal) {
    return Math.max(1, Math.round(targetTotal - elapsed));
  }

  const tailEstimate =
    steps.length > 0 && activeIndex < steps.length - 1
      ? steps.slice(activeIndex + 1).reduce((sum, item) => sum + estimateStepSeconds(item.command), 5)
      : 10;

  const overtime = Math.floor(elapsed - targetTotal);
  const windowSize = Math.max(10, tailEstimate);

  return Math.max(1, windowSize - (overtime % windowSize));
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

function getStepState(index: number, current: number, status: string): StepState {
  if (status === 'finished') return 'completed';

  const activeIndex = current >= 0 ? current : 0;
  if (index < activeIndex) return 'completed';
  if (index > activeIndex) return 'pending';

  return status === 'failed' ? 'failed' : 'running';
}

function calculateProgressPercent(
  status: string,
  stepsCount: number,
  current: number,
  elapsed: number,
  estimate: number | null,
): number {
  if (status === 'finished') return 100;

  if (status === 'failed') {
    return stepsCount > 0 && current >= 0 ? Math.round(((current + 1) / stepsCount) * 100) : 0;
  }

  if (stepsCount > 0 && current >= 0) {
    return Math.min(95, Math.max(5, Math.round(((current + 0.5) / stepsCount) * 100)));
  }

  if (estimate && estimate > 0) {
    const cap = stepsCount > 0 ? 25 : 95;
    return Math.min(cap, Math.max(2, Math.round((elapsed / estimate) * 100)));
  }

  return stepsCount > 0 ? 2 : 0;
}

function StepRow({
  stepItem,
  index,
  state,
}: {
  stepItem: DeploymentStep;
  index: number;
  state: StepState;
}) {
  const { copied, copy } = useClipboard();

  return (
    <div
      className={cn(
        'group flex items-start justify-between gap-3 px-3 py-3 text-sm leading-relaxed transition-colors',
        state === 'running' && 'bg-muted/50',
        state === 'failed' && 'bg-destructive/5',
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {state === 'completed' ? (
          <CheckCircle2Icon className="size-5 my-0.5 text-emerald-500 shrink-0" />
        ) : state === 'running' ? (
          <LoaderCircleIcon className="size-5 my-0.5 text-primary animate-spin shrink-0" />
        ) : state === 'failed' ? (
          <XCircleIcon className="size-5 my-0.5 text-destructive shrink-0" />
        ) : (
          <CircleIcon className="size-5 my-0.5 text-muted-foreground shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:gap-3">
          <span
            className={cn(
              'font-medium break-words sm:w-48 sm:shrink-0',
              state === 'failed' ? 'text-destructive' : 'text-foreground',
            )}
          >
            {index + 1}. {getStepTitle(stepItem.command)}
          </span>

          <code className="text-foreground/80 min-w-0 font-mono whitespace-pre-wrap break-all">
            $ {stepItem.command}
          </code>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground cursor-pointer shrink-0"
        onClick={() => copy(stepItem.command)}
        title="Copy command"
      >
        {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
      </Button>
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
  const [showSteps, setShowSteps] = useState(defaultShowSteps);

  const steps = deployment.progress?.steps ?? [];
  const estimate = deployment.progress?.estimated_duration ?? null;
  const current = step ? steps.findLastIndex((s) => s.group === step.group && s.line <= step.line) : -1;

  const endedAt = deploying ? now : moment(deployment.finished_at ?? deployment.updated_at).valueOf();
  const elapsed = Math.max(0, (endedAt - moment(deployment.created_at).valueOf()) / 1000);
  const remainingSeconds = deploying ? calculateRemainingSeconds(steps, current, elapsed, estimate) : 0;
  const percent = calculateProgressPercent(deployment.status, steps.length, current, elapsed, estimate);

  const title = deploying ? 'Deploying...' : failed ? 'Deployment failed' : 'Deployment completed';
  const activeStep = finished ? null : current >= 0 && steps[current] ? steps[current] : deploying ? (steps[0] ?? null) : null;

  const stepLabel =
    steps.length > 0
      ? finished
        ? `${steps.length}/${steps.length}`
        : `${Math.max(1, current + 1)}/${steps.length}`
      : null;

  return (
    <Card className={cn('p-3.5 flex flex-col gap-2.5 shadow-none', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {deploying ? (
            <LoaderCircleIcon className="size-4 text-primary animate-spin shrink-0" />
          ) : failed ? (
            <XCircleIcon className="size-4 text-destructive shrink-0" />
          ) : (
            <CheckCircle2Icon className="size-4 text-emerald-500 shrink-0" />
          )}

          <span className="text-sm font-medium shrink-0">{title}</span>

          {stepLabel && (
            <span className="text-xs text-muted-foreground font-mono shrink-0">{stepLabel}</span>
          )}

          {!showSteps && activeStep && (
            <code className="hidden sm:inline text-xs text-muted-foreground font-mono truncate">
              $ {activeStep.command}
            </code>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {deploying ? (
            <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 tabular-nums">
              <TimerIcon className="size-3.5 text-primary animate-pulse shrink-0" />
              <span className="font-mono font-semibold text-foreground">
                {formatCountdown(remainingSeconds)}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-muted-foreground tabular-nums">
              <Clock3Icon className="size-3.5 shrink-0" />
              <span className="font-mono font-medium text-foreground">{formatDuration(elapsed)}</span>
            </div>
          )}

          {steps.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 cursor-pointer"
              onClick={() => setShowSteps((prev) => !prev)}
              aria-label={showSteps ? 'Hide steps' : 'Show steps'}
            >
              {showSteps ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
            </Button>
          )}

          {action}
        </div>
      </div>

      <Progress
        value={percent}
        aria-label="Deployment progress"
        className={cn(
          'h-1.5',
          failed && '[&>[data-slot=progress-indicator]]:bg-destructive',
        )}
      />

      {steps.length > 0 && showSteps && (
        <div className="divide-y rounded-md border bg-muted/10 overflow-hidden">
          {steps.map((stepItem, index) => (
            <StepRow
              key={`${stepItem.group}-${stepItem.line}-${index}`}
              stepItem={stepItem}
              index={index}
              state={getStepState(index, current, deployment.status)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
