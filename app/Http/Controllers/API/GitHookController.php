<?php

namespace App\Http\Controllers\API;

use App\Actions\Site\Deploy;
use App\Enums\DeploymentTrigger;
use App\Http\Controllers\Controller;
use App\Models\GitHook;
use App\Models\ServerLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Spatie\RouteAttributes\Attributes\Post;
use Throwable;

class GitHookController extends Controller
{
    #[Post('api/git-hooks', name: 'api.git-hooks')]
    public function __invoke(Request $request): JsonResponse
    {
        if (! $request->input('secret')) {
            abort(404);
        }

        
        $gitHook = GitHook::query()
            ->where('secret', $request->input('secret'))
            ->firstOrFail();

        if (! $gitHook->site) {
            $gitHook->destroyHook();

            return response()->json([
                'success' => true,
            ]);
        }

        foreach ($gitHook->actions as $action) {
            
            $sourceControl = $gitHook->site->sourceControl;
            $webhookBranch = $sourceControl->provider()->getWebhookBranch($request->array());
            if ($action == 'deploy' && $gitHook->site->branch === $webhookBranch) {
                try {
                    app(Deploy::class)->run($gitHook->site, trigger: DeploymentTrigger::WEBHOOK);
                } catch (Throwable $e) {
                    ServerLog::log(
                        $gitHook->site->server,
                        'deploy-failed',
                        $e->getMessage(),
                        $gitHook->site
                    );
                    Log::error('git-hook-exception', ['site_id' => $gitHook->site_id, 'error' => $e->getMessage()]);
                }
            }
        }

        return response()->json([
            'success' => true,
        ]);
    }
}
