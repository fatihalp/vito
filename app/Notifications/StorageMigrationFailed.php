<?php

namespace App\Notifications;

use App\Models\StorageMigration;
use Illuminate\Notifications\Messages\MailMessage;

class StorageMigrationFailed extends AbstractNotification
{
    public function __construct(protected StorageMigration $storageMigration) {}

    public function rawText(): string
    {
        return __("A storage migration failed.\nCheck the migration for details.\n:link", [
            'link' => url('/projects/'.$this->storageMigration->project_id.'/storage-migrations/'.$this->storageMigration->id),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject(__('Storage migration failed'))
            ->line(__('A storage migration in your project failed to complete.'))
            ->line(__('Your backups were not moved. Check the migration to find out what went wrong.'))
            ->action(__('View migration'), url('/projects/'.$this->storageMigration->project_id.'/storage-migrations/'.$this->storageMigration->id));
    }
}
