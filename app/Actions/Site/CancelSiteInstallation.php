<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\SiteStatus;
use App\Events\SocketEvent;
use App\Http\Resources\SiteResource;
use App\Models\Site;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelSiteInstallation
{
    public function cancel(Site $site): Site
    {
        if (! $site->isInstalling()) {
            throw ValidationException::withMessages([
                'status' => 'Only sites with an active or failed installation can be cancelled.',
            ]);
        }

        DB::transaction(function () use ($site): void {
            $site->status = SiteStatus::READY;
            $site->progress_step = null;
            $site->last_error = null;
            $site->jsonForget('type_data', 'completed_steps', false);
            $site->jsonForget('type_data', 'completed_install_commands', false);
            $site->jsonForget('type_data', 'completed_deploy_commands', false);
            $site->save();

            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $site->server->project_id,
                type: 'site.updated',
                data: new SiteResource($site),
            ));
        });

        return $site;
    }
}
