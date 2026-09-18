<?php

namespace App\Http\Controllers;

use App\Actions\StorageMigration\ManageStorageMigration;
use App\Actions\StorageMigration\ManageStorageMigrationSettings;
use App\Http\Resources\StorageMigrationItemResource;
use App\Http\Resources\StorageMigrationResource;
use App\Http\Resources\StorageMigrationSettingResource;
use App\Models\StorageMigration;
use App\Models\StorageMigrationSetting;
use App\Tables\StorageMigrationTable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\Paginator;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Spatie\RouteAttributes\Attributes\WhereNumber;

#[Prefix('storage-migrations')]
#[Middleware(['auth', 'has-project'])]
class StorageMigrationController extends Controller
{

    #[Get('/', name: 'storage-migrations')]
    public function index(): Response
    {
        $this->authorize('viewAny', [StorageMigration::class, user()->currentProject]);

        return Inertia::render('storage-migrations/index', [
            'storageMigrations' => StorageMigrationTable::make(user()->currentProject->storageMigrations())->simplePaginate(),
        ]);
    }

    #[Post('/', name: 'storage-migrations.store')]
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', [StorageMigration::class, user()->currentProject]);

        app(ManageStorageMigration::class)->create(user()->currentProject, user(), $request->all());

        return back()->with('info', 'Storage migration is being prepared...');
    }

    #[Get('/queue-settings', name: 'storage-migrations.settings')]
    public function settings(): JsonResponse
    {
        $this->authorize('manageSettings', StorageMigration::class);

        $setting = StorageMigrationSetting::current();

        return response()->json([
            'setting' => StorageMigrationSettingResource::make($setting),
        ]);
    }

    #[Post('/queue-settings', name: 'storage-migrations.settings.update')]
    public function updateSettings(Request $request): RedirectResponse
    {
        $this->authorize('manageSettings', StorageMigration::class);

        app(ManageStorageMigrationSettings::class)->update($request->all());

        return back()->with('success', 'Queue settings saved. Apply them to take effect.');
    }

    #[Post('/queue-settings/apply', name: 'storage-migrations.settings.apply')]
    public function applySettings(): RedirectResponse
    {
        $this->authorize('manageSettings', StorageMigration::class);

        app(ManageStorageMigrationSettings::class)->apply();

        return back()->with('warning', 'Applied. The Horizon master process was restarted to pick up the change — your process supervisor must bring it back up.');
    }

    #[Get('/{storageMigration}', name: 'storage-migrations.show')]
    public function show(StorageMigration $storageMigration): Response
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('view', $storageMigration);

        $storageMigration->load('source', 'target', 'database.server')->withProcessingCount();
        $items = $storageMigration->started_at === null
            ? null
            : rescue(fn () => $storageMigration->items()->latest('id')->simplePaginate(config('web.pagination_size')), report: false);

        return Inertia::render('storage-migrations/show', [
            'storageMigration' => StorageMigrationResource::make($storageMigration),
            'items' => StorageMigrationItemResource::collection($items ?? new Paginator([], config('web.pagination_size'))),
            'itemsAvailable' => $items !== null,
            'scanDatabase' => $storageMigration->database ? [
                'server' => $storageMigration->database->server?->name,
                'database' => $storageMigration->database->name,
            ] : null,
        ]);
    }

    #[Get('/{storageMigration}/items/{item}/preview', name: 'storage-migrations.items.preview')]
    #[WhereNumber('item')]
    public function previewItem(Request $request, StorageMigration $storageMigration, int $item): JsonResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);
        $this->authorize('preview', $storageMigration);

        $this->authorize('view', $storageMigration);

        $request->validate([
            'side' => ['required', Rule::in(['source', 'target'])],
        ]);

        $migrationItem = $storageMigration->items()->findOrFail($item);
        $storage = $request->query('side') === 'source' ? $storageMigration->source : $storageMigration->target;
        $key = $request->query('side') === 'source' ? $migrationItem->source_key : $migrationItem->target_key;

        abort_if($storage === null, 404);

        return response()->json([
            'url' => $storage->provider()->presignedUrl($storage->credentials, $key),
        ]);
    }

    #[Patch('/{storageMigration}', name: 'storage-migrations.update')]
    public function update(Request $request, StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->update($storageMigration, $request->only('name'));

        return back()->with('success', 'Storage migration renamed.');
    }

    #[Post('/{storageMigration}/workers', name: 'storage-migrations.workers')]
    public function workers(Request $request, StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);
        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->updateWorkers($storageMigration, $request->only('worker_count'));

        return back()->with('success', 'Transfer worker count updated.');
    }

    #[Post('/{storageMigration}/pause', name: 'storage-migrations.pause')]
    public function pause(Request $request, StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->pause($storageMigration, $request->only('phase'));

        return back()->with('success', 'Requested phase paused. In-flight work will finish first.');
    }

    #[Post('/{storageMigration}/resume', name: 'storage-migrations.resume')]
    public function resume(Request $request, StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->resume($storageMigration, $request->only('phase'));

        return back()->with('success', 'Requested phase resumed.');
    }

    #[Post('/{storageMigration}/cancel', name: 'storage-migrations.cancel')]
    public function cancel(StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->cancel($storageMigration);

        return back()->with('warning', 'Storage migration cancelled.');
    }

    #[Post('/{storageMigration}/retry-failed', name: 'storage-migrations.retry-failed')]
    public function retryFailed(StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('update', $storageMigration);

        app(ManageStorageMigration::class)->retryFailed($storageMigration);

        return back()->with('info', 'Retrying failed items...');
    }

    #[Delete('/{storageMigration}', name: 'storage-migrations.destroy')]
    public function destroy(StorageMigration $storageMigration): RedirectResponse
    {
        abort_unless($storageMigration->project_id === user()->currentProject->id, 404);

        $this->authorize('delete', $storageMigration);

        app(ManageStorageMigration::class)->delete($storageMigration);

        return to_route('storage-migrations')->with('success', 'Storage migration deleted.');
    }
}
