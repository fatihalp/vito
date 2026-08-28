<?php

namespace App\Http\Controllers;

use App\Actions\Site\SearchEnvKey;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('settings/env-search')]
#[Middleware(['auth', 'must-be-admin'])]
class EnvSearchController extends Controller
{
    #[Get('/', name: 'env-search')]
    public function index(Request $request): Response
    {
        $key = trim((string) $request->query('key', ''));

        return Inertia::render('env-search/index', [
            'key' => $key,
            'results' => $key !== '' ? app(SearchEnvKey::class)->search($request->user(), $key) : null,
        ]);
    }
}
