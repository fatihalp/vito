<?php

namespace App\Http\Controllers;

use App\Actions\Overview\GetOverviewResources;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;

#[Middleware(['auth'])]
class OverviewController extends Controller
{
    #[Get('/overview', name: 'overview')]
    public function __invoke(): Response
    {
        return Inertia::render('overview');
    }

    #[Get('/overview/resources', name: 'overview.resources')]
    public function resources(Request $request): JsonResponse
    {
        return response()->json(app(GetOverviewResources::class)->handle(
            user(),
            array_filter(array_map('intval', (array) $request->input('servers', []))),
            array_filter(array_map('intval', (array) $request->input('sites', []))),
            $request->integer('fallback_server_id') ?: null,
        ));
    }
}
