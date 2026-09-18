<?php

namespace App\Http\Controllers;

use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManageBackup;
use App\Actions\Backup\RestoreToNewServer;
use App\Actions\Backup\RunBackup;
use App\Enums\BackupType;
use App\Http\Resources\BackupFileResource;
use App\Http\Resources\BackupResource;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\NotificationChannel;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Tables\BackupTable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;

#[Middleware(['auth', 'has-project'])]
class BackupController extends Controller
{

    #[Get('/backups', name: 'backups.all')]
    public function index(): Response
    {
        $this->authorize('view', user()->currentProject);

        return Inertia::render('backups/index', [
            'backups' => BackupTable::make(user()->currentProject->backups())->simplePaginate(),
            'attention' => app(CheckBackupHealth::class)->attention(user()->currentProject->backups()),
            'hasNotificationChannels' => NotificationChannel::query()->exists(),
        ]);
    }

    #[Get('/servers/{server}/backups', name: 'backups')]
    public function server(Server $server): Response
    {
        $this->authorize('viewAny', [Backup::class, $server]);

        $cluster = PostgresCluster::forServer($server);

        return Inertia::render('backups/index', [
            'backups' => BackupTable::make($server->backups())->forServer($server)->simplePaginate(),
            'attention' => app(CheckBackupHealth::class)->attention($server->backups()),
            'hasNotificationChannels' => NotificationChannel::query()->exists(),
            'replicaOf' => $cluster !== null && $cluster->primary_server_id !== $server->id
                ? ['server_id' => $cluster->primary_server_id, 'name' => $cluster->primary?->name, 'backup_id' => $cluster->backup_id]
                : null,
        ]);
    }

    #[Get('/servers/{server}/backups/{backup}', name: 'backups.show')]
    public function show(Server $server, Backup $backup): JsonResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('view', $backup);

        return response()->json([
            'backup' => BackupResource::make($backup),
            'files' => BackupFileResource::collection($backup->files()->simplePaginate(config('web.pagination_size'))),
        ]);
    }

    #[Post('/servers/{server}/backups', name: 'backups.store')]
    public function store(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('create', [Backup::class, $server]);

        app(ManageBackup::class)->create($server, $request->all());

        return back()
            ->with('info', 'Backup is being created...');
    }

    #[Patch('/servers/{server}/backups/{backup}', name: 'backups.update')]
    public function update(Request $request, Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('update', $backup);

        app(ManageBackup::class)->update($backup, $request->all());

        return back()
            ->with('success', 'Backup updated successfully.');
    }

    #[Get('/servers/{server}/backups/{backup}/passphrase', name: 'backups.passphrase')]
    public function passphrase(Server $server, Backup $backup): JsonResponse
    {
        abort_unless($backup->server_id === $server->id && $backup->type === BackupType::PGBACKREST, 404);

        $this->authorize('viewPassphrase', $backup);

        return response()->json([
            'passphrase' => $backup->configuration['cipher_pass'],
        ]);
    }

    #[Get('/servers/{server}/backups/{backup}/restore-to-server', name: 'backups.restore-to-server.requirements')]
    public function restoreRequirements(Server $server, Backup $backup): JsonResponse
    {
        abort_unless($backup->server_id === $server->id && $backup->type === BackupType::PGBACKREST, 404);

        $this->authorize('view', $backup);

        return response()->json(app(RestoreToNewServer::class)->requirements($backup));
    }

    #[Post('/servers/{server}/backups/{backup}/restore-to-server', name: 'backups.restore-to-server')]
    public function restoreToServer(Request $request, Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id && $backup->type === BackupType::PGBACKREST, 404);

        $this->authorize('viewPassphrase', $backup);
        $this->authorize('create', [Server::class, $server->project]);

        app(RestoreToNewServer::class)->create(user(), $backup, $request->all());

        return back()->with('info', 'The new server is being created. The restore starts as soon as it is ready.');
    }

    #[Post('/servers/{server}/backups/{backup}/run', name: 'backups.run')]
    public function run(Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('create', [BackupFile::class, $backup]);

        app(RunBackup::class)->run($backup);

        return back()
            ->with('info', 'Backup is being created...');
    }

    #[Post('/servers/{server}/backups/{backup}/enable', name: 'backups.enable')]
    public function enable(Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('update', $backup);

        app(ManageBackup::class)->enable($backup);

        return back()
            ->with('success', 'Backup enabled.');
    }

    #[Post('/servers/{server}/backups/{backup}/disable', name: 'backups.disable')]
    public function disable(Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('update', $backup);

        app(ManageBackup::class)->stop($backup);

        return back()
            ->with('success', 'Backup disabled.');
    }

    #[Delete('/servers/{server}/backups/{backup}', name: 'backups.destroy')]
    public function destroy(Server $server, Backup $backup): RedirectResponse
    {
        abort_unless($backup->server_id === $server->id, 404);

        $this->authorize('delete', $backup);

        app(ManageBackup::class)->delete($backup);

        return back()
            ->with('warning', 'Backup is being deleted...');
    }
}
