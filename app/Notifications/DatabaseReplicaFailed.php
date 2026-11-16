<?php

namespace App\Notifications;

use App\Models\DatabaseReplica;
use Illuminate\Notifications\Messages\MailMessage;

class DatabaseReplicaFailed extends AbstractNotification
{
    public function __construct(protected DatabaseReplica $replica) {}

    public function rawText(): string
    {
        return strtr("Setting up the PostgreSQL replica [:replica] of [:primary] failed.\n:message\n:link", [':replica' => $this->replica->replica->name, ':primary' => $this->replica->primary->name, ':message' => $this->replica->message, ':link' => $this->link()]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('PostgreSQL replica failed')
            ->line('Setting up the PostgreSQL replica ['.$this->replica->replica->name.'] of your server ['.$this->replica->primary->name.'] failed.')
            ->line((string) $this->replica->message)
            ->action('View replica', $this->link());
    }

    private function link(): string
    {
        return url('/servers/'.$this->replica->cluster->primary_server_id.'/database-replicas/'.$this->replica->id);
    }
}
