<?php

namespace App\Http\Controllers;

use App\Actions\StorageProvider\ConnectDropbox;
use App\Actions\StorageProvider\CreateStorageProvider;
use App\Actions\StorageProvider\DeleteStorageProvider;
use App\Actions\StorageProvider\EditStorageProvider;
use App\Http\Resources\StorageProviderResource;
use App\Models\StorageProvider;
use App\StorageProviders\S3;
use App\Tables\StorageProviderTable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

#[Prefix('settings/storage-providers')]
#[Middleware(['auth'])]
class StorageProviderController extends Controller
{

    #[Get('/', name: 'storage-providers')]
    public function index(): Response
    {
        $this->authorize('viewAny', StorageProvider::class);

        $user = user();

        return Inertia::render('storage-providers/index', [
            'storageProviders' => StorageProviderTable::make(
                StorageProvider::getByProjectId($user->current_project_id, $user)
            )->simplePaginate(),
        ]);
    }

    #[Get('/json', name: 'storage-providers.json')]
    public function json(): ResourceCollection
    {
        $this->authorize('viewAny', StorageProvider::class);

        $user = user();
        $storageProviders = StorageProvider::getByProjectId($user->current_project_id, $user)
            ->get();

        return StorageProviderResource::collection($storageProviders);
    }

    #[Post('/', name: 'storage-providers.store')]
    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', StorageProvider::class);

        app(CreateStorageProvider::class)->create(user(), $request->all());

        return back()->with('success', 'Storage provider created.');
    }

    #[Post('/dropbox/redirect', name: 'storage-providers.dropbox.redirect')]
    public function dropboxRedirect(Request $request, ConnectDropbox $action): SymfonyResponse
    {
        $this->authorize('create', StorageProvider::class);

        return Inertia::location($action->redirectUrl($request->all()));
    }

    #[Get('/dropbox/callback', name: 'storage-providers.dropbox.callback')]
    public function dropboxCallback(Request $request, ConnectDropbox $action): RedirectResponse
    {
        $this->authorize('create', StorageProvider::class);

        try {
            $action->handleCallback(user(), $request);
        } catch (ValidationException $e) {
            return to_route('storage-providers')->with('error', $e->validator->errors()->first());
        } catch (Throwable $e) {
            Log::error('Dropbox OAuth callback failed', ['exception' => get_class($e)]);

            return to_route('storage-providers')->with('error', __('Failed to connect to Dropbox.'));
        }

        return to_route('storage-providers')->with('success', 'Storage provider created.');
    }

    #[Post('/{storageProvider}/test', name: 'storage-providers.test')]
    public function test(Request $request, StorageProvider $storageProvider): JsonResponse
    {
        $this->authorize('view', $storageProvider);

        if (! $storageProvider->hasProviderHandler()) {
            return response()->json(['connected' => false]);
        }

        $handler = $storageProvider->provider();
        $readOnly = $request->query('mode') === 'read' && $handler instanceof S3;

        try {
            $connected = $readOnly
                ? $handler->canRead($storageProvider->credentials)
                : $handler->connect($storageProvider->credentials);
        } catch (Throwable $e) {
            Log::error('Failed to test storage provider connection', [
                'storage_provider_id' => $storageProvider->id,
                'exception' => get_class($e),
            ]);
            $connected = false;
        }

        return response()->json(['connected' => $connected]);
    }

    #[Patch('/{storageProvider}', name: 'storage-providers.update')]
    public function update(Request $request, StorageProvider $storageProvider): RedirectResponse
    {
        $this->authorize('update', $storageProvider);

        app(EditStorageProvider::class)->edit($storageProvider, $request->all());

        return back()->with('success', 'Storage provider updated.');
    }

    #[Delete('{storageProvider}', name: 'storage-providers.destroy')]
    public function destroy(StorageProvider $storageProvider): RedirectResponse
    {
        $this->authorize('delete', $storageProvider);

        app(DeleteStorageProvider::class)->delete($storageProvider);

        return to_route('storage-providers')->with('success', 'Storage provider deleted.');
    }
}
