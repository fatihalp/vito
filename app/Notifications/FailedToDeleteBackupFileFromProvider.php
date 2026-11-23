<?php

namespace App\Notifications;

use App\Models\BackupFile;
use Illuminate\Notifications\Messages\MailMessage;

class FailedToDeleteBackupFileFromProvider extends AbstractNotification
{
    public function __construct(protected BackupFile $backupFile) {}

    public function rawText(): string
    {
        $provider = $this->backupFile->backup?->storage?->provider ?? 'storage provider';

        return "Failed to delete backup file: {$this->backupFile->name} on storage: {$provider}";
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $provider = $this->backupFile->backup?->storage?->provider ?? 'storage provider';

        return (new MailMessage)
            ->error()
            ->subject('Failed to delete backup file')
            ->line(strtr('We couldn\'t delete the backup file [:file] from :provider.', [':file' => $this->backupFile->name, ':provider' => $provider]))
            ->line('Please check your storage provider and remove it manually.');
    }
}
