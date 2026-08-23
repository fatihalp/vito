<?php

namespace App\Http\Controllers;

use App\Actions\Projects\GetOverviewResources;
use App\Http\Resources\ProjectOverviewServerResource;
use App\Http\Resources\ProjectOverviewSiteResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;

#[Middleware(['auth', 'has-project'])]
class OverviewController extends Controller
{

    #[Get('/overview', name: 'overview')]
    public function __invoke(): Response
    {
        $this->authorize('view', user()->currentProject);

        return Inertia::render('overview');
    }

    #[Get('/overview/resources', name: 'overview.resources')]
    public function resources(Request $request): JsonResponse
    {
        $this->authorize('view', user()->currentProject);

        $resources = app(GetOverviewResources::class)->get(
            user()->currentProject,
            $request->only(['servers', 'sites', 'fallback_server_id']),
        );

        return response()->json([
            'servers' => ProjectOverviewServerResource::collection($resources['servers'])->resolve(),
            'sites' => ProjectOverviewSiteResource::collection($resources['sites'])->resolve(),
        ]);
    }
}
