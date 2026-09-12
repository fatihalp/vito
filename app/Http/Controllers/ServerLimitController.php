<?php

namespace App\Http\Controllers;

use App\Actions\Limits\GetServerLimits;
use App\Actions\Limits\UpdateNginxLimits;
use App\Actions\Limits\UpdatePhpLimits;
use App\Models\Server;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/limits')]
#[Middleware(['auth', 'has-project'])]
class ServerLimitController extends Controller
{
    #[Get('/', name: 'servers.limits')]
    public function index(Server $server): Response
    {
        $this->authorize('view', $server);

        return Inertia::render('servers/limits/index', [
            'limits' => app(GetServerLimits::class)->get($server),
        ]);
    }

    #[Patch('/nginx', name: 'servers.limits.nginx')]
    public function updateNginx(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        app(UpdateNginxLimits::class)->update($server, $request->input());

        return back()->with('success', __('Nginx limits updated and service reloaded successfully.'));
    }

    #[Patch('/php', name: 'servers.limits.php')]
    public function updatePhp(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        app(UpdatePhpLimits::class)->update($server, $request->input());

        return back()->with('success', __('PHP :version limits updated and service restarted successfully.', [
            'version' => $request->input('version'),
        ]));
    }
}
