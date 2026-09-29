<?php

namespace App\Http\Controllers;

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Http\Resources\DatabaseUpgradeResource;
use App\Models\DatabaseUpgrade;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/database-upgrades')]
#[Middleware(['auth', 'has-project'])]
class DatabaseUpgradeController extends Controller
{
    #[Get('/', name: 'database-upgrades')]
    public function index(Server $server): Response
    {
        $this->authorize('viewAny', [DatabaseUpgrade::class, $server]);

        $upgrade = DatabaseUpgrade::forServer($server, false)?->load('source', 'target', 'network');

        return Inertia::render('database-upgrades/index', [
            'upgrade' => $upgrade === null ? null : DatabaseUpgradeResource::make($upgrade),
        ]);
    }

    #[Get('/requirements', name: 'database-upgrades.requirements')]
    public function requirements(Server $server): JsonResponse
    {
        $this->authorize('create', [DatabaseUpgrade::class, $server]);

        return response()->json(app(ManageDatabaseUpgrade::class)->requirements($server));
    }

    #[Post('/', name: 'database-upgrades.store')]
    public function store(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('create', [DatabaseUpgrade::class, $server]);

        app(ManageDatabaseUpgrade::class)->create($request->user(), $server, $request->all());

        return back()->with('info', 'The new server is being created. The copy starts as soon as it is ready.');
    }

    #[Post('/{databaseUpgrade}/finish', name: 'database-upgrades.finish')]
    public function finish(Server $server, DatabaseUpgrade $databaseUpgrade): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseUpgrade);
        $this->authorize('finish', $databaseUpgrade);

        app(ManageDatabaseUpgrade::class)->finish($databaseUpgrade);

        return back()->with('warning', 'Switching over. '.$server->name.' stops taking writes...');
    }

    #[Post('/{databaseUpgrade}/cancel', name: 'database-upgrades.cancel')]
    public function cancel(Server $server, DatabaseUpgrade $databaseUpgrade): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseUpgrade);
        $this->authorize('update', $databaseUpgrade);

        app(ManageDatabaseUpgrade::class)->cancel($databaseUpgrade);

        return back()->with('warning', 'Stopping the copy and cleaning up both servers...');
    }

    #[Delete('/{databaseUpgrade}', name: 'database-upgrades.destroy')]
    public function destroy(Server $server, DatabaseUpgrade $databaseUpgrade): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseUpgrade);
        $this->authorize('delete', $databaseUpgrade);

        app(ManageDatabaseUpgrade::class)->delete($databaseUpgrade);

        return back()->with('info', 'The upgrade was removed from this server.');
    }

    private function ensureBelongs(Server $server, DatabaseUpgrade $upgrade): void
    {
        abort_unless(in_array($server->id, [$upgrade->source_server_id, $upgrade->target_server_id], true), 404);
    }
}
