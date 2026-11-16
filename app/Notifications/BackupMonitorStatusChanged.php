<?php

namespace App\Notifications;

use App\Models\BackupMonitor;
use Illuminate\Notifications\Messages\MailMessage;

class BackupMonitorStatusChanged extends AbstractNotification
{
    protected string $label;

    protected string $serverName;

    protected string $status;

    protected string $url;

    public function __construct(BackupMonitor $monitor, protected bool $recovered)
    {
        $this->label = $monitor->label;
        $this->serverName = $monitor->server->name;
        $this->status = $monitor->status->value;
        $this->url = url('/servers/'.$monitor->server_id.'/backups#backup-monitor-'.$monitor->id);
    }

    public function rawText(): string
    {
        return __('Backup monitor :label on server [:server] reports :status.', [
            'label' => $this->label,
            'server' => $this->serverName,
            'status' => __($this->status),
        ])."\n".$this->link();
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__($this->recovered ? 'Backup monitoring recovered on :server' : 'Backup monitoring needs attention on :server', ['server' => $this->serverName]))
            ->line($this->rawText())
            ->action(__('View backup monitoring'), $this->link());
    }

    private function link(): string
    {
        return $this->url;
    }
}
