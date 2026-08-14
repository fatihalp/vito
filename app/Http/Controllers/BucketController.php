<?php

namespace App\Http\Controllers;

use App\Actions\Bucket\ConnectBucketCredentials;
use App\Actions\Bucket\CreateBucket;
use App\Actions\Bucket\DeleteBucket;
use App\Actions\Bucket\DisconnectBucketCredentials;
use App\Actions\Bucket\RevealBucketCredentials;
use App\Http\Resources\BucketResource;
use App\Models\Bucket;
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

#[Prefix('buckets')]
#[Middleware(['auth', 'has-project'])]
class BucketController extends Controller
{
    #[Get('/', name: 'buckets')]
    public function index(): Response
    {
        $project = user()->currentProject;

        $this->authorize('viewAny', [Bucket::class, $project]);

        return Inertia::render('buckets/index', [
            'buckets' => BucketResource::collection($project->buckets()->latest()->get()),
            'credentialsConnected' => $project->bucketCredential()->exists(),
        ]);
    }

    #[Post('/credentials', name: 'buckets.credentials.store')]
    public function storeCredentials(Request $request): RedirectResponse
    {
        $project = user()->currentProject;

        $this->authorize('manageCredentials', [Bucket::class, $project]);

        app(ConnectBucketCredentials::class)->connect($project, $request->all());

        return back()->with('success', 'Hetzner Object Storage credentials connected.');
    }

    #[Delete('/credentials', name: 'buckets.credentials.destroy')]
    public function destroyCredentials(): RedirectResponse
    {
        $project = user()->currentProject;

        $this->authorize('manageCredentials', [Bucket::class, $project]);

        if ($credential = $project->bucketCredential) {
            app(DisconnectBucketCredentials::class)->disconnect($credential);
        }

        return back()->with('success', 'Hetzner Object Storage credentials disconnected.');
    }

    #[Post('/', name: 'buckets.store')]
    public function store(Request $request): RedirectResponse
    {
        $project = user()->currentProject;

        $this->authorize('create', [Bucket::class, $project]);

        app(CreateBucket::class)->create($project, $request->all());

        return back()->with('success', 'Bucket created successfully.');
    }

    #[Get('/{bucket}/reveal', name: 'buckets.reveal')]
    public function reveal(Bucket $bucket): JsonResponse
    {
        $this->authorize('revealCredentials', $bucket);

        return response()->json(app(RevealBucketCredentials::class)->reveal($bucket));
    }

    #[Delete('/{bucket}', name: 'buckets.destroy')]
    public function destroy(Bucket $bucket): RedirectResponse
    {
        $this->authorize('delete', $bucket);

        app(DeleteBucket::class)->delete($bucket);

        return back()->with('success', 'Bucket connection deleted successfully.');
    }
}
