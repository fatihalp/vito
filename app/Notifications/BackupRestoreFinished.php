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
        ['source' => $source, 'server' => $server, 'error' => $error, 'link' => $link] = $this->replacements();

        return $this->restore->status === BackupRestoreStatus::COMPLETED
            ? "The backup of [{$source}] was restored to the new server [{$server}].\n{$link}"
            : "Restoring the backup of [{$source}] to the new server [{$server}] failed:\n{$error}\n{$link}";
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $completed = $this->restore->status === BackupRestoreStatus::COMPLETED;

        return (new MailMessage)
            ->{$completed ? 'success' : 'error'}()
            ->subject($completed ? 'Backup restored to '.$this->replacements()['server'] : 'Backup restore failed')
            ->line($this->rawText())
            ->action('View restores', $this->replacements()['link']);
    }

    private function replacements(): array
    {
        $backup = $this->restore->backup;

        return [
            'source' => $backup->server->name,
            'server' => $this->restore->server?->name ?? 'deleted server',
            'error' => (string) $this->restore->message,
            'link' => url('/servers/'.$backup->server_id.'/backups/'.$backup->id.'/files'),
        ];
    }
}
