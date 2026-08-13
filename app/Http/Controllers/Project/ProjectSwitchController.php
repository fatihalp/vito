<?php

namespace App\Http\Controllers\Project;

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
    public function __invoke(Project $project): RedirectResponse
    {
        $this->authorize('view', $project);

        user()->update([
            'current_project_id' => $project->id,
        ]);

        return redirect()->route('overview');
    }
}
