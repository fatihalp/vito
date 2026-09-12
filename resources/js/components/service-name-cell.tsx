import type { CellComponentProps } from '@forjedio/inertia-table-react';
import { ServiceNetworkedBadge } from '@/components/service-networked-badge';
import { Service } from '@/types/service';

export function ServiceNameCell({ row, value, column }: CellComponentProps) {
  const service = row.resource as Service | undefined;
  const name = String(value ?? service?.name ?? '');

  return (
    <div className="flex flex-col items-start gap-1 py-0.5">
      <span className="font-medium text-foreground">{name}</span>
      {service?.supports_networking && (
        <ServiceNetworkedBadge row={row} value={row.networked} column={column} />
      )}
    </div>
  );
}
