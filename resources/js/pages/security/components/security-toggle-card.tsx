import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LoaderCircleIcon } from 'lucide-react';
import { useDialog } from '@/hooks/use-dialog';

function ControlBadge({ status, color, secure }: { status: string; color: 'gray' | 'success' | 'info' | 'warning' | 'danger'; secure: boolean }) {
  if (status === 'disabled') {
    return null;
  }
  if (status === 'active' && !secure) {
    return null;
  }
  return (
    <Badge variant={color} aria-busy={status === 'updating'}>
      {status === 'updating' && <LoaderCircleIcon className="animate-spin" />}
      {status}
    </Badge>
  );
}

interface SecurityToggleState {
  status: string;
  status_color: 'gray' | 'success' | 'info' | 'warning' | 'danger';
  enabled: boolean;
  detected: boolean | null;
  manageable?: boolean;
}

interface SecurityToggleCardProps {
  title: string;
  description: string | React.ReactNode;
  state: SecurityToggleState;
  onToggle: (nextSecure: boolean) => void;
}

export default function SecurityToggleCard({
  title,
  description,
  state,
  onToggle,
}: SecurityToggleCardProps) {
  const updating = state.status === 'updating';
  const secure = !state.enabled;
  const drift = !updating && state.detected != null && state.detected !== state.enabled;
  const disabled = updating || (state.manageable !== undefined && !state.manageable);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              {title}
              <ControlBadge status={state.status} color={state.status_color} secure={secure} />
              {drift && <Badge variant="warning">drift detected</Badge>}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Switch checked={secure} disabled={disabled} onCheckedChange={onToggle} aria-label={title} />
        </div>
      </CardHeader>
    </Card>
  );
}
