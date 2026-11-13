<?php

namespace App\Http\Middleware;

use App\Actions\Projects\SwitchProject;
use App\Models\Network;
use App\Models\Project;
use App\Models\Server;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;

class ResolveCurrentProject
{
    public const string HEADER = 'X-Vito-Project';

    public const string SCOPE_ATTRIBUTE = 'project_scope';

    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return $next($request);
        }

        $routeProjectId = $this->routeProjectId($request);
        $explicitProject = $this->accessibleProject($user, $routeProjectId ?? $this->queryProjectId($request));
        if ($explicitProject && $user->current_project_id !== $explicitProject->id) {
            app(SwitchProject::class)->switch($user, $explicitProject);
        }

        $project = $explicitProject
            ?? $this->accessibleProject($user, $this->headerProjectId($request))
            ?? $this->accessibleProject($user, $user->current_project_id)
            ?? $user->ensureHasDefaultProject();

        $user->current_project_id = $project->id;
        $user->setRelation('currentProject', $project);

        $request->attributes->set(
            self::SCOPE_ATTRIBUTE,
            $routeProjectId === null && $request->query('project') === 'all' ? 'all' : (string) $project->id,
        );

        return $next($request);
    }

    private function routeProjectId(Request $request): ?int
    {
        $server = $request->route('server');
        if ($server !== null) {
            return $server instanceof Server ? $server->project_id : Server::withTrashed()->whereKey($server)->value('project_id');
        }

        $network = $request->route('network');
        if ($network !== null) {
            return $network instanceof Network ? $network->project_id : Network::withTrashed()->whereKey($network)->value('project_id');
        }

        return null;
    }

    private function queryProjectId(Request $request): ?int
    {
        $project = $request->query('project');

        return is_string($project) && ctype_digit($project) ? (int) $project : null;
    }

    private function headerProjectId(Request $request): ?int
    {
        $project = $request->header(self::HEADER);

        return is_string($project) && ctype_digit($project) ? (int) $project : null;
    }

    private function accessibleProject(User $user, ?int $projectId): ?Project
    {
        if ($projectId === null) {
            return null;
        }

        $project = Project::query()->find($projectId);

        return $project && $user->can('view', $project) ? $project : null;
    }
}
