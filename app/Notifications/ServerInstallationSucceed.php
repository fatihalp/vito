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

        return __("Installation succeed for server [:server] \nServer IP: :ip \n:link", [
            'server' => $this->server->name,
            'ip' => $this->server->ip,
            'link' => url('/servers/'.$this->server->id),
        ]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $this->server->refresh();

        return (new MailMessage)
            ->success()
            ->subject(__('Your server is ready'))
            ->line(__('Your server [:server] has been installed successfully and is ready to use.', ['server' => $this->server->name]))
            ->line(__('Server IP: :ip', ['ip' => $this->server->ip]))
            ->action(__('Manage your server'), url('/servers/'.$this->server->id));
    }
}
