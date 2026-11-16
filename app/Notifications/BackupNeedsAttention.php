<?php

namespace App\Notifications;

use App\Models\Backup;
use Illuminate\Notifications\Messages\MailMessage;

class BackupNeedsAttention extends AbstractNotification
{
    public function __construct(protected Backup $backup, protected array $problems) {}

    public function rawText(): string
    {
        return strtr("The backup of :target on server [:server] needs attention:\n:problems\n:link", [':target' => $this->backup->target() ?? '-', ':server' => $this->backup->server->name, ':problems' => collect($this->problems)->map(fn (string $problem): string => '- '.$problem)->implode("\n"), ':link' => url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files')]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->error()
            ->subject('Backup needs attention on '.$this->backup->server->name)
            ->line('The backup of '.($this->backup->target() ?? '-').' on your server ['.$this->backup->server->name.'] needs attention.');

        foreach ($this->problems as $problem) {
            $mail->line($problem);
        }

        return $mail->action('View backup', url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files'));
    }
}
