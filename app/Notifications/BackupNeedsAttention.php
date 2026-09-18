<?php

namespace App\Notifications;

use App\Models\Backup;
use Illuminate\Notifications\Messages\MailMessage;

class BackupNeedsAttention extends AbstractNotification
{
    /**
     * @param  array<string, string>  $problems
     */
    public function __construct(protected Backup $backup, protected array $problems) {}

    public function rawText(): string
    {
        return __("The backup of :target on server [:server] needs attention:\n:problems\n:link", [
            'target' => $this->backup->target() ?? '-',
            'server' => $this->backup->server->name,
            'problems' => collect($this->problems)->map(fn (string $problem): string => '- '.$problem)->implode("\n"),
            'link' => url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files'),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->error()
            ->subject(__('Backup needs attention on :server', ['server' => $this->backup->server->name]))
            ->line(__('The backup of :target on your server [:server] needs attention.', [
                'target' => $this->backup->target() ?? '-',
                'server' => $this->backup->server->name,
            ]));

        foreach ($this->problems as $problem) {
            $mail->line($problem);
        }

        return $mail->action(__('View backup'), url('/servers/'.$this->backup->server_id.'/backups/'.$this->backup->id.'/files'));
    }
}
