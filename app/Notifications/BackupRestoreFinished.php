<?php

namespace App\Notifications;

use App\Enums\BackupRestoreStatus;
use App\Models\BackupRestore;
use Illuminate\Notifications\Messages\MailMessage;

class BackupRestoreFinished extends AbstractNotification
{
    public function __construct(protected BackupRestore $restore) {}

    public function rawText(): string
    {
        return $this->restore->status === BackupRestoreStatus::COMPLETED
            ? __("The backup of [:source] was restored to the new server [:server].\n:link", $this->replacements())
            : __("Restoring the backup of [:source] to the new server [:server] failed:\n:error\n:link", $this->replacements());
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $completed = $this->restore->status === BackupRestoreStatus::COMPLETED;

        return (new MailMessage)
            ->{$completed ? 'success' : 'error'}()
            ->subject($completed ? __('Backup restored to :server', ['server' => $this->replacements()['server']]) : __('Backup restore failed'))
            ->line($this->rawText())
            ->action(__('View restores'), $this->replacements()['link']);
    }

    /**
     * @return array{source: string, server: string, error: string, link: string}
     */
    private function replacements(): array
    {
        $backup = $this->restore->backup;

        return [
            'source' => $backup->server->name,
            'server' => $this->restore->server?->name ?? __('deleted server'),
            'error' => (string) $this->restore->message,
            'link' => url('/servers/'.$backup->server_id.'/backups/'.$backup->id.'/files'),
        ];
    }
}
