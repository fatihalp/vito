import { CheckCircle2Icon, LoaderCircleIcon, XCircleIcon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Deployment } from '@/types/deployment';

export type DeploymentState = 'live' | 'deploying' | 'finished' | 'failed';

export const DEPLOYMENT_STATES: Record<DeploymentState, { label: string; className: string }> = {
  live: { label: 'Live', className: 'text-success' },
  deploying: { label: 'Deploying', className: 'text-info' },
  finished: { label: 'Finished', className: 'text-muted-foreground' },
  failed: { label: 'Failed', className: 'text-destructive' },
};

const STATE_ICONS: Record<Exclude<DeploymentState, 'live'>, LucideIcon> = {
  deploying: LoaderCircleIcon,
  finished: CheckCircle2Icon,
  failed: XCircleIcon,
};

export const deploymentState = (deployment: Deployment): DeploymentState => {
  if (deployment.active) {
    return 'live';
  }

  return deployment.status === 'deploying' || deployment.status === 'failed' ? deployment.status : 'finished';
};

export const deploymentActor = (deployment: Deployment): string | null =>
  deployment.trigger === 'manual' || !deployment.trigger ? deployment.deployed_by : deployment.trigger;

export function DeploymentStateGlyph({ state }: { state: DeploymentState }) {
  if (state === 'live') {
    return (
      <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="bg-success/25 absolute size-4 animate-pulse rounded-full" />
        <span className="bg-success size-2 rounded-full" />
      </span>
    );
  }

  const Icon = STATE_ICONS[state];

  return <Icon className={cn('size-4 shrink-0', DEPLOYMENT_STATES[state].className, state === 'deploying' && 'animate-spin')} aria-hidden="true" />;
}
