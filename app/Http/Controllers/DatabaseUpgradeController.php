<?php

namespace App\Http\Controllers;

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Exceptions\SSHError;
use App\Http\Resources\DatabaseUpgradeResource;
use App\Models\DatabaseUpgrade;
use App\Models\Server;
use App\Models\ServerLog;
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
            'logs' => $upgrade === null ? [] : $this->logs($upgrade),
        ]);
    }

    #[Get('/versions', name: 'database-upgrades.versions')]
    public function versions(Server $server): JsonResponse
    {
        $this->authorize('create', [DatabaseUpgrade::class, $server]);

        return response()->json(app(ManageDatabaseUpgrade::class)->versions($server));
    }

    #[Get('/requirements', name: 'database-upgrades.requirements')]
    public function requirements(Server $server): JsonResponse
    {
        $this->authorize('create', [DatabaseUpgrade::class, $server]);

        try {
            return response()->json(app(ManageDatabaseUpgrade::class)->requirements($server));
        } catch (SSHError $e) {
            return response()->json([
                'message' => __('Vito could not read the PostgreSQL settings of :server: :error', ['server' => $server->name, 'error' => $e->getMessage()]),
            ], 422);
        }
    }

    #[Post('/', name: 'database-upgrades.store')]
    public function store(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('create', [DatabaseUpgrade::class, $server]);

        app(ManageDatabaseUpgrade::class)->create($request->user(), $server, $request->all());

        return back()->with('info', 'The new server is being created. The copy starts as soon as it is ready.');
    }

    #[Get('/{databaseUpgrade}/output', name: 'database-upgrades.output')]
    public function output(Server $server, DatabaseUpgrade $databaseUpgrade): JsonResponse
    {
        $this->ensureBelongs($server, $databaseUpgrade);
        $this->authorize('view', $databaseUpgrade);

        return response()->json(['content' => app(ManageDatabaseUpgrade::class)->output($databaseUpgrade)]);
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

    /**
     * The command logs both servers wrote for this upgrade, newest first, so the full SSH output is one click away.
     *
     * @return list<array{id: int, name: string, server_id: int, server_name: ?string, created_at: ?string}>
     */
    private function logs(DatabaseUpgrade $upgrade): array
    {
        return ServerLog::query()
            ->whereIn('server_id', array_filter([$upgrade->source_server_id, $upgrade->target_server_id]))
            ->where(fn ($query) => $query
                ->where('name', 'like', '%database-upgrade%')
                ->orWhere('name', 'like', '%vito-upgrade-'.$upgrade->id.'%')
                ->orWhere('name', 'like', '%postgres-private-interface%'))
            ->where('created_at', '>=', $upgrade->created_at)
            ->with('server')
            ->latest('id')
            ->limit(40)
            ->get()
            ->map(fn (ServerLog $log): array => [
                'id' => $log->id,
                'name' => $log->name,
                'server_id' => $log->server_id,
                'server_name' => $log->server?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();
    }

    private function ensureBelongs(Server $server, DatabaseUpgrade $upgrade): void
    {
        abort_unless(in_array($server->id, [$upgrade->source_server_id, $upgrade->target_server_id], true), 404);
    }
}
