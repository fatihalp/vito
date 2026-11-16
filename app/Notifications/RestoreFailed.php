<?php

namespace App\Notifications;

use App\Models\BackupFile;
use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class RestoreFailed extends AbstractNotification
{
    public function __construct(protected Server $server, protected BackupFile $backupFile) {}

    public function rawText(): string
    {
        return strtr("Restoring the backup [:name] on server [:server] failed.\nCheck the backup logs for details.\n:link", [':name' => $this->backupFile->name, ':server' => $this->server->name, ':link' => url('/servers/'.$this->server->id.'/backups/'.$this->backupFile->backup_id)]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('Backup restore failed')
            ->line('Restoring the backup ['.$this->backupFile->name.'] on your server ['.$this->server->name.'] failed to complete.')
            ->line('Check the backup logs to find out what went wrong.')
            ->action('View backup', url('/servers/'.$this->server->id.'/backups/'.$this->backupFile->backup_id));
    }
}
