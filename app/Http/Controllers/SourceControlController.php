<?php

namespace App\Http\Controllers;

use App\Actions\SourceControl\ConnectSourceControl;
use App\Actions\SourceControl\DeleteSourceControl;
use App\Actions\SourceControl\EditSourceControl;
use App\Http\Resources\SourceControlResource;
use App\Models\SourceControl;
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
    public function index(): Response
    {
        $this->authorize('viewAny', SourceControl::class);

        $user = user();
        $sourceControls = SourceControl::getByProjectId($user->current_project_id, $user)
            ->simplePaginate(config('web.pagination_size'), pageName: 'sourceControlsPage');

        return Inertia::render('source-controls/index', [
            'sourceControls' => SourceControlResource::collection($sourceControls),
        ]);
    }

    #[Get('/json', name: 'source-controls.json')]
    public function json(): ResourceCollection
    {
        $this->authorize('viewAny', SourceControl::class);

        $user = user();
        $sourceControls = SourceControl::getByProjectId($user->current_project_id, $user)
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

    #[Post('/match', name: 'source-controls.match')]
    public function match(Request $request): JsonResponse
    {
        $this->authorize('create', SourceControl::class);

        $user = user();
        $token = $request->input('token');

        if (empty($token)) {
            return response()->json([
                'id' => null,
                'sourceControls' => SourceControlResource::collection(
                    SourceControl::getByProjectId($user->current_project_id, $user)->get()
                ),
            ]);
        }

        // Find existing source control with the same access token
        $existing = SourceControl::where('user_id', $user->id)->get()->first(function ($sc) use ($token) {
            return ($sc->provider_data['token'] ?? $sc->access_token) === $token;
        });

        if ($existing) {
            return response()->json([
                'id' => $existing->id,
                'sourceControls' => SourceControlResource::collection(
                    SourceControl::getByProjectId($user->current_project_id, $user)->get()
                ),
            ]);
        }

        // Create new one!
        $sourceControl = app(\App\Actions\SourceControl\ConnectSourceControl::class)->connect($user, [
            'provider' => 'github',
            'name' => 'GitHub (Imported)',
            'token' => $token,
            'global' => true,
        ]);

        return response()->json([
            'id' => $sourceControl->id,
            'sourceControls' => SourceControlResource::collection(
                SourceControl::getByProjectId($user->current_project_id, $user)->get()
            ),
        ]);
    }

    #[Patch('/{sourceControl}', name: 'source-controls.update')]
    public function update(Request $request, SourceControl $sourceControl): RedirectResponse
    {
        $this->authorize('update', $sourceControl);

        app(EditSourceControl::class)->edit($sourceControl, $request->all());

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
