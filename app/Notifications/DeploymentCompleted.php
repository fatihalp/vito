<?php

namespace App\Notifications;

use App\Enums\DeploymentStatus;
use App\Models\Deployment;
use App\Models\Site;
use Illuminate\Notifications\Messages\MailMessage;

class DeploymentCompleted extends AbstractNotification
{
    public function __construct(protected Deployment $deployment, protected Site $site) {}

    public function rawText(): string
    {
        $text = 'Deployment for site ['.$this->site->domain.'] has completed with status: '.$this->deployment->status->getText();

        if ($this->commitSummary() !== null) {
            $text .= "\n".'Commit: '.$this->commitSummary();
        }

        return $text;
    }

    public function toEmail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->subject('Deployment completed')
            ->line('Deployment for site ['.$this->site->domain.'] completed with status: '.$this->deployment->status->getText().'.');

        if ($this->commitSummary() !== null) {
            $message->line('Commit: '.$this->commitSummary());
        }

        if (! empty($this->deployment->commit_data['name'])) {
            $message->line('Author: '.$this->deployment->commit_data['name']);
        }

        $message->action('View site', url('/servers/'.$this->site->server_id.'/sites/'.$this->site->id));

        if ($this->deployment->status === DeploymentStatus::FINISHED) {
            return $message->success();
        }

        if ($this->deployment->status === DeploymentStatus::FAILED) {
            return $message->error();
        }

        return $message;
    }

    private function commitSummary(): ?string
    {
        $commitMessage = $this->deployment->commit_data['message'] ?? null;

        if (empty($commitMessage)) {
            return null;
        }

        $summary = trim((string) explode("\n", (string) $commitMessage)[0]);
        $shortId = $this->deployment->commit_id ? substr($this->deployment->commit_id, 0, 7) : null;

        return $shortId !== null ? $summary.' ('.$shortId.')' : $summary;
    }

    public function toSlack(object $notifiable): string
    {
        return $this->rawText();
    }

    public function toDiscord(object $notifiable): string
    {
        return $this->rawText();
    }

    public function toTelegram(object $notifiable): string
    {
        return $this->rawText();
    }
}
