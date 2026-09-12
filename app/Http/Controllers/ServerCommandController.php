<?php

namespace App\Http\Controllers;

use App\Actions\Server\GetServerCommandHistory;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/commands')]
#[Middleware(['auth', 'has-project'])]
class ServerCommandController extends Controller
{
    #[Get('/', name: 'servers.commands')]
    public function index(Server $server, Request $request): Response
    {
        $this->authorize('view', $server);

        $data = $server->isReady()
            ? app(GetServerCommandHistory::class)->handle($server, $request->only('source', 'lines', 'search'))
            : ['source' => 'sudo', 'items' => []];

        return Inertia::render('servers/commands', [
            'initialData' => $data,
        ]);
    }

    #[Post('/query', name: 'servers.commands.query')]
    public function query(Server $server, Request $request): JsonResponse
    {
        $this->authorize('view', $server);

        $data = app(GetServerCommandHistory::class)->handle(
            $server,
            $request->only('source', 'lines', 'search')
        );

        return response()->json($data);
    }
}
