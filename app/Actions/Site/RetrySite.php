<?php

namespace App\Actions\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\SiteStatus;
use App\Events\SocketEvent;
use App\Http\Resources\SiteResource;
use App\Jobs\Site\CreateJob;
use App\Models\Site;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class RetrySite
{
    
    public function retry(Site $site, array $input = []): Site
    {
        if (! $site->isInstallationFailed()) {
            throw ValidationException::withMessages([
                'status' => 'Only sites in the installation_failed state can be retried.',
            ]);
        }

        $validated = Validator::make($input, [
            'composer_install_command' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        DB::transaction(function () use ($site, $validated): void {
            if (array_key_exists('composer_install_command', $validated)) {
                $command = $validated['composer_install_command'];
                $typeData = $site->type_data ?? [];

                if ($command === null || trim($command) === '') {
                    unset($typeData['composer_install_command']);
                } else {
                    $typeData['composer_install_command'] = $command;
                }

                $site->type_data = $typeData;
            }

            $site->status = SiteStatus::INSTALLING;
            $site->last_error = null;
            $site->progress_step = null;
            $site->progress = 0;
            $site->save();

            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $site->server->project_id,
                type: 'site.updated',
                data: new SiteResource($site),
            ));

            dispatch(new CreateJob($site));
        });

        return $site;
    }
}
