<?php

namespace App\Http\Controllers;

use App\Actions\GithubApp\EditGithubAppSourceControl;
use App\Actions\SourceControl\ConnectSourceControl;
use App\Actions\SourceControl\DeleteSourceControl;
use App\Actions\SourceControl\EditSourceControl;
use App\Helpers\QueryBuilder;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\SourceControlResource;
use App\Http\Resources\UserResource;
use App\Models\Project;
use App\Models\Server;
use App\Models\SourceControl;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Spatie\RouteAttributes\Attributes\Where;

#[Prefix('settings/source-controls')]
#[Middleware(['auth'])]
class SourceControlController extends Controller
{

    #[Get('/', name: 'source-controls')]
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', SourceControl::class);

        $user = user();
        $query = SourceControl::query()
            ->when(! $user->isAdmin(), fn ($query) => $query->where('user_id', $user->id))
            ->with(['user', 'project']);

        if ($provider = $request->input('provider')) {
            if ($provider !== 'all') {
                $query->where('provider', $provider);
            }
        }

        if ($projectId = $request->input('project_id')) {
            if ($projectId === 'global') {
                $query->whereNull('project_id');
            } elseif ($projectId !== 'all') {
                $query->where('project_id', (int) $projectId);
            }
        }

        if ($userId = $request->input('user_id')) {
            if ($userId !== 'all') {
                $query->where('user_id', (int) $userId);
            }
        }

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('profile', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%")
                    ->orWhere('external_identifier', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('project', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        $sourceControls = QueryBuilder::for($query)
            ->sortable('created_at', 'desc', [
                'name' => 'profile',
                'global' => 'project_id',
            ])
            ->simplePaginate(pageName: 'sourceControlsPage');

        $projects = $user->isAdmin()
            ? Project::query()->orderBy('name')->get()
            : $user->allProjects()->sortBy('name')->values();

        $users = $user->isAdmin()
            ? User::query()->orderBy('name')->get()
            : collect([$user]);

        $providers = [
            ['value' => 'all', 'label' => 'All Providers'],
            ['value' => 'github', 'label' => 'GitHub'],
            ['value' => 'github-app', 'label' => 'GitHub App'],
            ['value' => 'gitlab', 'label' => 'GitLab'],
            ['value' => 'bitbucket', 'label' => 'Bitbucket'],
            ['value' => 'custom', 'label' => 'Custom'],
        ];

        return Inertia::render('source-controls/index', [
            'sourceControls' => SourceControlResource::collection($sourceControls),
            'projects' => ProjectResource::collection($projects),
            'users' => UserResource::collection($users),
            'providers' => $providers,
            'filters' => [
                'search' => $request->input('search', ''),
                'provider' => $request->input('provider', 'all'),
                'project_id' => $request->input('project_id', 'all'),
                'user_id' => $request->input('user_id', 'all'),
            ],
        ]);
    }

    #[Get('/json', name: 'source-controls.json')]
    public function json(Request $request): ResourceCollection
    {
        $this->authorize('viewAny', SourceControl::class);

        $serverId = $request->integer('server');

        if ($serverId) {
            $server = Server::query()->findOrFail($serverId);
            $this->authorize('view', $server);

            $sourceControls = SourceControl::usableForServer($server)->with('user')->get();

            return SourceControlResource::collection($sourceControls);
        }

        $user = user();
        $sourceControls = SourceControl::getByProjectId($user->current_project_id, $user)
            ->with('user')
            ->get();

        return SourceControlResource::collection($sourceControls);
    }

    #[Get('/{source_control}/repos', name: 'source-controls.repos')]
    public function repos(SourceControl $sourceControl): JsonResponse
    {
        $this->authorize('view', $sourceControl);

        return response()->json($sourceControl->provider()->getRepos());
    }

    #[Get('/{source_control}/repos/nocache', name: 'source-controls.repos.nocache')]
    public function liveRepos(SourceControl $sourceControl): JsonResponse
    {
        $this->authorize('view', $sourceControl);

        return response()->json($sourceControl->provider()->getRepos(false));
    }

    #[Get('/{source_control}/branches/{repo}', name: 'source-controls.branches')]
    #[Where('repo', '.*')]
    public function branches(SourceControl $sourceControl, string $repo): JsonResponse
    {
        $this->authorize('view', $sourceControl);

        return response()->json($sourceControl->provider()->getBranches($repo));
    }

    #[Get('/{source_control}/branches/nocache/{repo}', name: 'source-controls.branches.nocache')]
    #[Where('repo', '.*')]
    public function liveBranches(SourceControl $sourceControl, string $repo): JsonResponse
    {
        $this->authorize('view', $sourceControl);

        return response()->json($sourceControl->provider()->getBranches($repo, false));
    }

    #[Post('/', name: 'source-controls.store')]
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', SourceControl::class);

        $user = user();

        app(ConnectSourceControl::class)->connect($user, $request->all());

        return back()->with('success', 'Source control created.');
    }

    #[Patch('/{sourceControl}', name: 'source-controls.update')]
    public function update(Request $request, SourceControl $sourceControl): RedirectResponse
    {
        $this->authorize('update', $sourceControl);

        if ($sourceControl->isGithubApp()) {
            app(EditGithubAppSourceControl::class)->edit($sourceControl, $request->all());
        } else {
            app(EditSourceControl::class)->edit($sourceControl, $request->all());
        }

        return back()->with('success', 'Source control updated.');
    }

    #[Delete('{sourceControl}', name: 'source-controls.destroy')]
    public function destroy(SourceControl $sourceControl): RedirectResponse
    {
        $this->authorize('delete', $sourceControl);

        app(DeleteSourceControl::class)->delete($sourceControl);

        return to_route('source-controls')->with('success', 'Source control deleted.');
    }
}
