<?php

namespace App\Notifications;

use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class ServerDisconnected extends AbstractNotification
{
    public function __construct(protected Server $server) {}

    public function rawText(): string
    {
        return 'Connection lost to the server ['.$this->server->name.']';
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('Server connection lost')
            ->line('Vito has lost connection to your server ['.$this->server->name.'].')
            ->line('Please make sure the server is online and still has Vito\'s public keys installed.')
            ->action('Check server', url('/servers/'.$this->server->id));
    }
}
