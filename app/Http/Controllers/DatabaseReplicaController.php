<?php

namespace App\Http\Controllers;

use App\Actions\DatabaseReplica\GetDatabaseReplicaMetrics;
use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Actions\PostgresCluster\PromoteReplica;
use App\Http\Resources\DatabaseReplicaResource;
use App\Http\Resources\PostgresClusterResource;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Tables\DatabaseReplicaTable;
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

#[Prefix('servers/{server}/database-replicas')]
#[Middleware(['auth', 'has-project'])]
class DatabaseReplicaController extends Controller
{
    #[Get('/', name: 'database-replicas')]
    public function index(Server $server): Response
    {
        $this->authorize('viewAny', [DatabaseReplica::class, $server]);

        $cluster = PostgresCluster::forServer($server)?->load('primary', 'network', 'backup.storage');

        return Inertia::render('database-replicas/index', [
            'cluster' => $cluster ? PostgresClusterResource::make($cluster) : null,
            'replicas' => DatabaseReplicaTable::make(DatabaseReplica::query()->where('postgres_cluster_id', $cluster?->id ?? 0))->simplePaginate(),
        ]);
    }

    #[Get('/{databaseReplica}', name: 'database-replicas.show')]
    public function show(Request $request, Server $server, DatabaseReplica $databaseReplica): Response
    {
        $this->ensureBelongs($server, $databaseReplica);
        $this->authorize('view', $databaseReplica);

        $databaseReplica->load('cluster.primary', 'cluster.network', 'replica', 'latestMetric');

        return Inertia::render('database-replicas/show', [
            'replica' => DatabaseReplicaResource::make($databaseReplica),
            'cluster' => PostgresClusterResource::make($databaseReplica->cluster),
            ...app(GetDatabaseReplicaMetrics::class)->get($databaseReplica, $request->only('period')),
        ]);
    }

    #[Get('/{databaseReplica}/seed-output', name: 'database-replicas.seed-output')]
    public function seedOutput(Server $server, DatabaseReplica $databaseReplica): JsonResponse
    {
        $this->ensureBelongs($server, $databaseReplica);
        $this->authorize('view', $databaseReplica);

        return response()->json([
            'content' => app(ManageDatabaseReplica::class)->seedOutput($databaseReplica),
        ]);
    }

    #[Post('/', name: 'database-replicas.store')]
    public function store(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('create', [DatabaseReplica::class, $server]);

        app(ManageDatabaseReplica::class)->create($server, $request->all());

        return back()->with('info', 'The replica is being set up...');
    }

    #[Post('/{databaseReplica}/resync', name: 'database-replicas.resync')]
    public function resync(Server $server, DatabaseReplica $databaseReplica): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseReplica);
        $this->authorize('update', $databaseReplica);

        app(ManageDatabaseReplica::class)->resync($databaseReplica);

        return back()->with('info', 'The replica is being rebuilt from the latest backup...');
    }

    #[Post('/{databaseReplica}/promote', name: 'database-replicas.promote')]
    public function promote(Request $request, Server $server, DatabaseReplica $databaseReplica): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseReplica);
        $this->authorize('update', $databaseReplica);

        app(PromoteReplica::class)->promote($databaseReplica, $request->only('force', 'confirmation'));

        return back()->with('warning', 'Failing over to the replica...');
    }

    #[Post('/failover/retry', name: 'database-replicas.failover.retry')]
    public function retryFailover(Request $request, Server $server): RedirectResponse
    {
        $cluster = PostgresCluster::forServer($server);

        abort_if($cluster === null, 404);

        $this->authorize('manage', [DatabaseReplica::class, $server]);

        app(PromoteReplica::class)->retry($cluster, $request->only('force'));

        return back()->with('warning', 'Continuing the failover...');
    }

    #[Delete('/{databaseReplica}', name: 'database-replicas.destroy')]
    public function destroy(Server $server, DatabaseReplica $databaseReplica): RedirectResponse
    {
        $this->ensureBelongs($server, $databaseReplica);
        $this->authorize('delete', $databaseReplica);

        app(ManageDatabaseReplica::class)->delete($databaseReplica);

        return to_route('database-replicas', ['server' => $server])->with('warning', 'The replica is being removed...');
    }

    private function ensureBelongs(Server $server, DatabaseReplica $replica): void
    {
        abort_unless(in_array($server->id, [$replica->cluster->primary_server_id, $replica->replica_server_id], true), 404);
    }
}
