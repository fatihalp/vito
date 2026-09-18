<?php

namespace App\Notifications;

use App\Models\Backup;
use Illuminate\Notifications\Messages\MailMessage;

class BackupRecovered extends AbstractNotification
{
    public function __construct(protected Backup $backup) {}

    public function rawText(): string
    {
        return __("The backup of :target on server [:server] is healthy again.\n:link", [
            'target' => $this->backup->target() ?? '-',
            'server' => $this->backup->server->name,
            'link' => url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files'),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->success()
            ->subject(__('Backup recovered on :server', ['server' => $this->backup->server->name]))
            ->line(__('The backup of :target on your server [:server] is healthy again.', [
                'target' => $this->backup->target() ?? '-',
                'server' => $this->backup->server->name,
            ]))
            ->action(__('View backup'), url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files'));
    }
}
