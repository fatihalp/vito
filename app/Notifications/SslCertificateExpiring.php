<?php

namespace App\Notifications;

use App\Models\Ssl;
use Illuminate\Notifications\Messages\MailMessage;

class SslCertificateExpiring extends AbstractNotification
{
    public function __construct(protected Ssl $ssl) {}

    public function rawText(): string
    {
        return strtr("The SSL certificate for [:domain] :expiry.\nRenew it to keep the site served over HTTPS.\n:link", [':domain' => $this->domainLabel(), ':expiry' => $this->expiryLabel(), ':link' => $this->link()]);
    }

    public function toEmail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->error()
            ->subject('SSL certificate expiring soon')
            ->line('The SSL certificate for ['.$this->domainLabel().'] '.$this->expiryLabel().'.')
            ->line('Renew the certificate to keep the site served over HTTPS without interruption.')
            ->action('Manage certificates', $this->link());
    }

    private function domainLabel(): string
    {
        $domains = array_filter((array) $this->ssl->domains);

        if (! empty($domains)) {
            return implode(', ', $domains);
        }

        return (string) $this->ssl->site?->domain;
    }

    private function expiryLabel(): string
    {
        $expiresAt = $this->ssl->expires_at;

        if ($expiresAt === null) {
            return 'is expiring soon';
        }

        if ($expiresAt->isPast()) {
            return 'has expired';
        }

        return 'expires in '.((int) ceil(now()->diffInDays($expiresAt, false))).' day(s) ('.$expiresAt->toFormattedDayDateString().')';
    }

    private function link(): string
    {
        return url('/servers/'.$this->ssl->site?->server_id.'/sites/'.$this->ssl->site_id.'/domains');
    }
}
