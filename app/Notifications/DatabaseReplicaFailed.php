<?php

namespace App\Notifications;

use App\Models\DatabaseReplica;
use Illuminate\Notifications\Messages\MailMessage;

class DatabaseReplicaFailed extends AbstractNotification
{
    public function __construct(protected DatabaseReplica $replica) {}

    public function rawText(): string
    {
        return __("Setting up the PostgreSQL replica [:replica] of [:primary] failed.\n:message\n:link", [
            'replica' => $this->replica->replica->name,
            'primary' => $this->replica->primary->name,
            'message' => $this->replica->message,
            'link' => $this->link(),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject(__('PostgreSQL replica failed'))
            ->line(__('Setting up the PostgreSQL replica [:replica] of your server [:primary] failed.', [
                'replica' => $this->replica->replica->name,
                'primary' => $this->replica->primary->name,
            ]))
            ->line((string) $this->replica->message)
            ->action(__('View replica'), $this->link());
    }

    private function link(): string
    {
        return url('/servers/'.$this->replica->cluster->primary_server_id.'/database-replicas/'.$this->replica->id);
    }
}
