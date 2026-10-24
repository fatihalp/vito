<?php

namespace App\Http\Controllers;

use App\Actions\Site\StartEnvSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/env-search')]
#[Middleware(['auth', 'must-be-admin'])]
class EnvSearchController extends Controller
{
    #[Get('/', name: 'env-search')]
    public function index(): Response
    {
        return Inertia::render('env-search/index');
    }

    #[Post('/', name: 'env-search.search')]
    public function search(Request $request): JsonResponse
    {
        return response()->json(['search_id' => app(StartEnvSearch::class)->start($request->user(), $request->all())]);
    }

    #[Get('/{searchId}', name: 'env-search.status')]
    public function status(string $searchId): JsonResponse
    {
        return response()->json(app(StartEnvSearch::class)->status(user(), $searchId));
    }
}
