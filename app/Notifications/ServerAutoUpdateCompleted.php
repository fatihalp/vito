<?php

namespace App\Notifications;

use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class ServerAutoUpdateCompleted extends AbstractNotification
{
    public function __construct(
        protected Server $server,
        protected int $upgraded,
        protected int $kernelUpdatesRemaining,
        protected bool $rebootRequired,
    ) {}

    public function rawText(): string
    {
        $text = 'Automatic update completed for server ['.$this->server->name.']. Packages upgraded: '.$this->upgraded;

        if ($this->kernelUpdatesRemaining > 0) {
            $text .= "\n".'Kernel updates available: '.$this->kernelUpdatesRemaining.' (not applied automatically)';
        }

        if ($this->rebootRequired) {
            $text .= "\n".'This server needs to be rebooted to finish applying updates.';
        }

        return $text;
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->success()
            ->subject('Automatic update completed')
            ->line('Vito automatically applied package updates to your server ['.$this->server->name.'].')
            ->line('Packages upgraded: '.$this->upgraded);

        if ($this->kernelUpdatesRemaining > 0) {
            $message
                ->line('Kernel updates available: '.$this->kernelUpdatesRemaining)
                ->line('Kernel updates are not applied automatically — you can apply them from the server\'s page (this requires a reboot).');
        }

        if ($this->rebootRequired) {
            $message->line('This server needs to be rebooted to finish applying updates.');
        }

        return $message->action('View server', url('/servers/'.$this->server->id));
    }
}
