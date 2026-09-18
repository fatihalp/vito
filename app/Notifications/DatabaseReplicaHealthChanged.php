<?php

namespace App\Notifications;

use App\Enums\DatabaseReplicaHealth;
use App\Models\DatabaseReplica;
use Illuminate\Notifications\Messages\MailMessage;

class DatabaseReplicaHealthChanged extends AbstractNotification
{
    public function __construct(protected DatabaseReplica $replica, protected DatabaseReplicaHealth $previous) {}

    public function rawText(): string
    {
        return __("PostgreSQL replica [:replica] of [:primary] is :health (was :previous).\n:reasons\n:link", [
            'replica' => $this->replica->replica->name,
            'primary' => $this->replica->primary->name,
            'health' => $this->replica->health->getText(),
            'previous' => $this->previous->getText(),
            'reasons' => implode("\n", $this->replica->health_reasons ?? []),
            'link' => $this->link(),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject(__('PostgreSQL replica is :health', ['health' => $this->replica->health->getText()]))
            ->line(__('The PostgreSQL replica [:replica] of your server [:primary] changed from :previous to :health.', [
                'replica' => $this->replica->replica->name,
                'primary' => $this->replica->primary->name,
                'previous' => $this->previous->getText(),
                'health' => $this->replica->health->getText(),
            ]));

        if ($this->replica->health !== DatabaseReplicaHealth::HEALTHY) {
            $message->error();
        }

        foreach ($this->replica->health_reasons ?? [] as $reason) {
            $message->line($reason);
        }

        return $message->action(__('View replica'), $this->link());
    }

    private function link(): string
    {
        return url('/servers/'.$this->replica->cluster->primary_server_id.'/database-replicas/'.$this->replica->id);
    }
}
