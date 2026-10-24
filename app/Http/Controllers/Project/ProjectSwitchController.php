<?php

namespace App\Http\Controllers\Project;

use App\Actions\Projects\SwitchProject;
use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/projects')]
#[Middleware(['auth'])]
class ProjectSwitchController extends Controller
{

    #[Patch('switch/{project}', name: 'projects.switch')]
    public function __invoke(Project $project, SwitchProject $switchProject): RedirectResponse
    {
        $this->authorize('view', $project);

        $switchProject->switch(user(), $project);

        return redirect()->route('servers');
    }
}
