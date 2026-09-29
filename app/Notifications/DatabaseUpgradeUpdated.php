<?php

namespace App\Notifications;

use App\Enums\DatabaseUpgradeStatus;
use App\Models\DatabaseUpgrade;
use Illuminate\Notifications\Messages\MailMessage;

class DatabaseUpgradeUpdated extends AbstractNotification
{
    public function __construct(protected DatabaseUpgrade $upgrade) {}

    public function rawText(): string
    {
        return $this->line()."\n".$this->link();
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->{$this->upgrade->status === DatabaseUpgradeStatus::FAILED ? 'error' : 'success'}()
            ->subject($this->subject())
            ->line($this->line())
            ->action(__('View the upgrade'), $this->link());
    }

    private function subject(): string
    {
        return match ($this->upgrade->status) {
            DatabaseUpgradeStatus::STREAMING => __('PostgreSQL upgrade ready to finish'),
            DatabaseUpgradeStatus::COMPLETED => __('PostgreSQL upgrade completed'),
            default => __('PostgreSQL upgrade failed'),
        };
    }

    private function line(): string
    {
        $replacements = [
            'source' => $this->upgrade->source?->name ?? __('the old server'),
            'target' => $this->upgrade->target?->name ?? __('the new server'),
            'version' => $this->upgrade->target_version,
            'error' => (string) $this->upgrade->message,
        ];

        return match ($this->upgrade->status) {
            DatabaseUpgradeStatus::STREAMING => __('[:target] now holds every database of [:source] and keeps up with its changes. Finish the upgrade when you are ready to switch.', $replacements),
            DatabaseUpgradeStatus::COMPLETED => __('[:source] moved to [:target] on PostgreSQL :version. [:source] no longer takes writes, so point your applications at [:target].', $replacements),
            default => __('Upgrading [:source] to [:target] failed: :error', $replacements),
        };
    }

    private function link(): string
    {
        return url('/servers/'.$this->upgrade->source_server_id.'/database-upgrades');
    }
}
