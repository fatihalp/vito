<?php

namespace App\Http\Controllers;

use App\Jobs\Site\SearchEnvKeyJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
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
        $validated = Validator::make($request->all(), [
            'key' => ['required', 'string', 'max:255', 'regex:/^[A-Za-z_][A-Za-z0-9_]*$/'],
        ])->validate();

        $searchId = (string) Str::uuid();

        Cache::put("env-search-result:{$searchId}", ['status' => 'pending'], now()->addMinutes(10));

        SearchEnvKeyJob::dispatch($request->user(), $validated['key'], $searchId)->onQueue('ssh');

        return response()->json(['search_id' => $searchId]);
    }

    #[Get('/{searchId}', name: 'env-search.status')]
    public function status(string $searchId): JsonResponse
    {
        return response()->json(
            Cache::get("env-search-result:{$searchId}", ['status' => 'not_found'])
        );
    }
}
