import { useTranslate } from '@/hooks/use-translate';
import { Server } from '@/types/server';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontalIcon } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { useDialog } from '@/hooks/use-dialog';

export default function Actions({ server }: { server: Server }) {
  const translateText = useTranslate();
  const dialog = useDialog();
  const page = usePage<{ dataRetention: string }>();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="p-0">
          <span className="sr-only">{translateText('Open menu')}</span>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => dialog.dataRetention.open({ server, dataRetention: page.props.dataRetention })}>
          {translateText('Data retention')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() =>
            dialog.confirm.open({
              title: 'Reset metrics',
              description: translateText("Are you sure you want to reset metrics? This will delete all existing monitoring metrics data for server :value and cannot be undone.", { value: server.name }),
              variant: 'destructive',
              confirmLabel: 'Reset',
              method: 'delete',
              url: `/servers/${server.id}/monitoring/reset`,
            })
          }
        >
          {translateText('Reset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
