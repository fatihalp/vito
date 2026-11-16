import { useTranslate } from '@/hooks/use-translate';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { NotificationChannel } from '@/types/notification-channel';
import { useDialog } from '@/hooks/use-dialog';

export default function Delete({ notificationChannel }: { notificationChannel: NotificationChannel }) {
  const translateText = useTranslate();
  const dialog = useDialog();

  return (
    <DropdownMenuItem
      variant="destructive"
      onSelect={() =>
        dialog.confirm.open({
          title: translateText("Delete :value", { value: notificationChannel.name }),
          description: translateText("Are you sure you want to delete :value?", { value: notificationChannel.name }),
          variant: 'destructive',
          confirmLabel: 'Delete',
          method: 'delete',
          url: `/settings/notification-channels/${notificationChannel.id}`,
        })
      }
    >
      {translateText('Delete')}
    </DropdownMenuItem>
  );
}
