<?php

namespace App\Http\Controllers\Project;

use App\Actions\Projects\LeaveProject;
use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/projects')]
#[Middleware(['auth'])]
class LeaveProjectController extends Controller
{

    #[Delete('/{project}/leave', name: 'projects.leave')]
    public function __invoke(Project $project): RedirectResponse
    {
        app(LeaveProject::class)->leave($project, user());

        return back()->with('success', __('You left the project successfully.'));
    }
}
