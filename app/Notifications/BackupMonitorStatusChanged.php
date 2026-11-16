<?php

namespace App\Notifications;

use App\Models\BackupMonitor;
use Illuminate\Notifications\Messages\MailMessage;

class BackupMonitorStatusChanged extends AbstractNotification
{
    public function __construct(protected BackupMonitor $monitor, protected bool $recovered) {}

    public function rawText(): string
    {
        return __('Backup monitor :label on server [:server] reports :status.', [
            'label' => $this->monitor->label,
            'server' => $this->monitor->server->name,
            'status' => __($this->monitor->status->value),
        ])."\n".$this->link();
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__($this->subject(), ['server' => $this->monitor->server->name]))
            ->line($this->rawText())
            ->action(__('View backup monitoring'), $this->link());
    }

    private function subject(): string
    {
        return $this->recovered
            ? 'Backup monitoring recovered on :server'
            : 'Backup monitoring needs attention on :server';
    }

    private function link(): string
    {
        return url('/servers/'.$this->monitor->server_id.'/backups#backup-monitor-'.$this->monitor->id);
    }
}
