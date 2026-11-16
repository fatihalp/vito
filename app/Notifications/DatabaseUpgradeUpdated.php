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
            ->action('View the upgrade', $this->link());
    }

    private function subject(): string
    {
        return match ($this->upgrade->status) {
            DatabaseUpgradeStatus::STREAMING => 'PostgreSQL upgrade ready to finish',
            DatabaseUpgradeStatus::COMPLETED => 'PostgreSQL upgrade completed',
            default => 'PostgreSQL upgrade failed',
        };
    }

    private function line(): string
    {
        $source = $this->upgrade->source?->name ?? 'the old server';
        $target = $this->upgrade->target?->name ?? 'the new server';
        $version = $this->upgrade->target_version;
        $error = (string) $this->upgrade->message;

        return match ($this->upgrade->status) {
            DatabaseUpgradeStatus::STREAMING => "[{$target}] now holds every database of [{$source}] and keeps up with its changes. Finish the upgrade when you are ready to switch.",
            DatabaseUpgradeStatus::COMPLETED => "[{$source}] moved to [{$target}] on PostgreSQL {$version}. [{$source}] no longer takes writes, so point your applications at [{$target}].",
            default => "Upgrading [{$source}] to [{$target}] failed: {$error}",
        };
    }

    private function link(): string
    {
        return url('/servers/'.$this->upgrade->source_server_id.'/database-upgrades');
    }
}
