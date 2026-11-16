<?php

namespace App\Notifications;

use App\Models\Site;
use Illuminate\Notifications\Messages\MailMessage;

class WebhookDeploymentFailed extends AbstractNotification
{
    public function __construct(protected Site $site) {}

    public function rawText(): string
    {
        return strtr("A push-triggered deployment for site [:site] could not be started.\nCheck the server logs for details.\n:link", [':site' => $this->site->domain, ':link' => url('/servers/'.$this->site->server_id.'/logs')]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('Deployment failed to start')
            ->line('A deployment for your site ['.$this->site->domain.'] was triggered by a push but could not be started.')
            ->line('No deployment was run. Check the server logs to find out what went wrong, then deploy again.')
            ->action('View logs', url('/servers/'.$this->site->server_id.'/logs'));
    }
}
