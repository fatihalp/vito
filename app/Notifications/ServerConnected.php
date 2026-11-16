<?php

namespace App\Notifications;

use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class ServerConnected extends AbstractNotification
{
    public function __construct(protected Server $server) {}

    public function rawText(): string
    {
        return 'Connection successful to the server ['.$this->server->name.']';
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->success()
            ->subject('Server reconnected')
            ->line('Vito has successfully connected to your server ['.$this->server->name.'].')
            ->action('View server', url('/servers/'.$this->server->id));
    }
}
