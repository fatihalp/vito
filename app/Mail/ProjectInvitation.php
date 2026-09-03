<?php

namespace App\Mail;

use App\Models\Project;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ProjectInvitation extends Mailable
{
    use Queueable, SerializesModels;

    public Project $project;

    public function __construct(Project $project)
    {
        $this->project = $project;
    }

    public function build(): static
    {
        return $this
            ->markdown('mail.project-invitation', [
                'acceptUrl' => route('projects'),
            ])
            ->subject(__('Added to :project in Vito', ['project' => $this->project->name]));
    }
}
