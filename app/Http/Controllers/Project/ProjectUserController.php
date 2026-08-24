<?php

namespace App\Http\Controllers\Project;

use App\Actions\Projects\InviteToProject;
use App\Actions\Projects\GetProjectInvitees;
use App\Actions\User\CreateUser;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectInviteeResource;
use App\Models\Project;
use App\Models\UserProject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/projects/{project}/users')]
#[Middleware(['auth'])]
class ProjectUserController extends Controller
{

    #[Get('/json', name: 'projects.users.json')]
    public function json(Request $request, Project $project): ResourceCollection
    {
        $this->authorize('update', $project);

        return ProjectInviteeResource::collection(
            app(GetProjectInvitees::class)->get($project, $request->input())
        );
    }

    #[Post('/', name: 'projects.users.store')]
    public function store(Request $request, Project $project): RedirectResponse
    {
        $this->authorize('update', $project);

        app(InviteToProject::class)->invite($project, $request->input());

        return back()->with('success', __('The user has been invited to the project.'));
    }

    #[Post('/quick-create', name: 'projects.users.quick-create')]
    public function quickCreate(Request $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $user = app(CreateUser::class)->create($request->all());

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ]);
    }

    #[Delete('{id}', name: 'projects.users.destroy')]
    public function destroy(Project $project, int $id): RedirectResponse
    {
        $this->authorize('update', $project);

        
        $userProject = $project->users()->where('id', $id)->first();

        if ($userProject?->user && $project->role($userProject->user) === UserRole::OWNER) {
            return back()->with('error', __('You cannot remove the project owner.'));
        }

        if ($userProject?->email === user()->email || $userProject?->user_id === user()->id) {
            return back()->with('error', __('You cannot remove yourself from the project.'));
        }

        $project->users()
            ->where('id', $id)
            ->delete();

        return back()->with('success', __('The user has been removed.'));
    }
}
