<?php

namespace App\Notifications;

use App\Models\Site;
use Illuminate\Notifications\Messages\MailMessage;

class SiteInstallationSucceed extends AbstractNotification
{
    public function __construct(protected Site $site) {}

    public function rawText(): string
    {
        return 'Installation succeed for site ['.$this->site->domain.']';
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->success()
            ->subject('Your site is ready')
            ->line('Your site ['.$this->site->domain.'] has been installed successfully.')
            ->action('Open site', url('/servers/'.$this->site->server_id.'/sites/'.$this->site->id));
    }
}
