import type { CellComponentProps } from '@forjedio/inertia-table-react';
import { GlobeIcon, InfoIcon, LockIcon, TriangleAlertIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Service } from '@/types/service';
import { useDialog } from '@/hooks/use-dialog';

export function ServiceNetworkedBadge({ row, value }: CellComponentProps) {
  const dialog = useDialog();
  const label = String(value ?? 'unknown');

  if (label === 'n/a') {
    return null;
  }

  const service = row.resource as Service | undefined;

  if (!service || !service.supports_networking) {
    return null;
  }

  const isRemoteOpen = label === 'yes' || service.networking_enabled;
  const drifted = service.networking_managed && service.networking_effective !== null && service.networking_effective !== service.networking_enabled;
  const intentWithoutObservation = service.networking_enabled && service.networking_effective === null;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => dialog.serviceNetworking.open({ service })}
        className="cursor-pointer focus:outline-none inline-flex"
        title="Click to view/change remote networking settings"
      >
        {isRemoteOpen ? (
          <Badge variant="success" className="gap-1 text-xs hover:opacity-80 transition-opacity">
            <GlobeIcon className="size-3" />
            <span>Remote: Open</span>
          </Badge>
        ) : (
          <Badge variant="gray" className="gap-1 text-xs hover:opacity-80 transition-opacity">
            <LockIcon className="size-3" />
            <span>Remote: Local Only</span>
          </Badge>
        )}
      </button>
      {drifted && (
        <Tooltip>
          <TooltipTrigger asChild>
            <TriangleAlertIcon className="text-warning size-4" />
          </TooltipTrigger>
          <TooltipContent>Doesn&apos;t match Vito&apos;s setting - open Networking to reapply.</TooltipContent>
        </Tooltip>
      )}
      {intentWithoutObservation && (
        <Tooltip>
          <TooltipTrigger asChild>
            <InfoIcon className="text-muted-foreground size-4" />
          </TooltipTrigger>
          <TooltipContent>Networking is enabled by Vito - live state not checked yet. Use Refresh.</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
