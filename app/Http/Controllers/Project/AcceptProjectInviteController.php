<?php

namespace App\Http\Controllers\Project;

use App\Actions\Projects\AcceptProjectInvite;
use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/projects')]
#[Middleware(['auth'])]
class AcceptProjectInviteController extends Controller
{

    #[Get('/{project}/invitations/accept', name: 'projects.invitations.accept')]
    public function __invoke(Project $project): RedirectResponse
    {
        app(AcceptProjectInvite::class)->accept($project, user());

        return redirect()->route('projects')->with('success', __('You joined the project successfully.'));
    }
}
