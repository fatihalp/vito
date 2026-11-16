<?php

namespace App\Notifications;

use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class ServerUpdateFailed extends AbstractNotification
{
    public function __construct(protected Server $server) {}

    public function rawText(): string
    {
        return strtr("Update failed for server [:server] \nCheck your server's logs \n:logs", [':server' => $this->server->name, ':logs' => url('/servers/'.$this->server->id.'/logs')]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('Server update failed')
            ->line('An update on your server ['.$this->server->name.'] failed.')
            ->line('Check the server logs to find out what went wrong.')
            ->action('View logs', url('/servers/'.$this->server->id.'/logs'));
    }
}
