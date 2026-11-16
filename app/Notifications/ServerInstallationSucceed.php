<?php

namespace App\Notifications;

use App\Models\Server;
use Illuminate\Notifications\Messages\MailMessage;

class ServerInstallationSucceed extends AbstractNotification
{
    public function __construct(protected Server $server) {}

    public function rawText(): string
    {
        $this->server->refresh();

        return strtr("Installation succeed for server [:server] \nServer IP: :ip \n:link", [':server' => $this->server->name, ':ip' => $this->server->ip, ':link' => url('/servers/'.$this->server->id)]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $this->server->refresh();

        return (new MailMessage)
            ->success()
            ->subject('Your server is ready')
            ->line('Your server ['.$this->server->name.'] has been installed successfully and is ready to use.')
            ->line('Server IP: '.$this->server->ip)
            ->action('Manage your server', url('/servers/'.$this->server->id));
    }
}
