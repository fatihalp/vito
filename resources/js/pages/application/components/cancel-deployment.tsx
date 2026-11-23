import { type ComponentProps } from 'react';
import { XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/hooks/use-dialog';
import { cn } from '@/lib/utils';

interface CancelDeploymentTarget {
  serverId: number;
  siteId: number;
  deploymentId: number;
}

export function useCancelDeployment() {
  const dialog = useDialog();

  return ({ serverId, siteId, deploymentId }: CancelDeploymentTarget) => {
    dialog.confirm.open({
      title: 'Cancel deployment?',
      description: 'Stop this deployment immediately. Any running deployment commands on the server will be terminated.',
      confirmLabel: 'Cancel deployment',
      variant: 'destructive',
      method: 'post',
      url: `/servers/${serverId}/sites/${siteId}/deployments/${deploymentId}/cancel`,
    });
  };
}

export default function CancelDeployment({
  serverId,
  siteId,
  deploymentId,
  size,
  className,
  label = 'Cancel deployment',
}: CancelDeploymentTarget & {
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
  label?: string;
}) {
  const cancelDeployment = useCancelDeployment();

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        'text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 cursor-pointer',
        className,
      )}
      onClick={() => cancelDeployment({ serverId, siteId, deploymentId })}
    >
      <XCircleIcon className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      <span>{label}</span>
    </Button>
  );
}
