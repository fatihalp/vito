<?php

namespace App\WorkflowActions\SiteResource;

use App\Models\Site;
use App\WorkflowActions\AbstractWorkflowAction;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ConnectSiteResource extends AbstractWorkflowAction
{
    public function inputs(): array
    {
        return [
            'site_id' => 'The ID of the site to connect resource to',
            'type' => 'The type of resource: database, cache, storage',
            'server_id' => 'The ID of the server (optional, defaults to site server)',
            'database_name' => 'Database name (optional, auto-generated if omitted)',
            'storage_provider_id' => 'Storage provider ID (optional, required if type is storage)',
        ];
    }

    public function outputs(): array
    {
        return [
            'resource_id' => 'The ID of the connected site resource',
            'resource_type' => 'The type of the connected site resource',
        ];
    }

    public function run(array $input): array
    {
        Validator::make($input, [
            'site_id' => ['required', 'integer', 'exists:sites,id'],
            'type' => ['required', Rule::in(['database', 'cache', 'storage'])],
            'server_id' => ['nullable', 'integer', 'exists:servers,id'],
            'storage_provider_id' => ['nullable', 'integer'],
            'database_name' => ['nullable', 'string', 'max:64'],
        ])->validate();

        $site = Site::query()->findOrFail($input['site_id']);
        $type = $input['type'];

        $this->authorize('update', [$site, $site->server]);

        $existing = $site->resources()->where('type', $type)->first();
        if ($existing) {
            return [
                'resource_id' => $existing->id,
                'resource_type' => $existing->type->value,
            ];
        }

        $connectData = [
            'type' => $type,
            'server_id' => $input['server_id'] ?? $site->server_id,
            'confirm_overwrite' => true,
        ];

        if (! empty($input['database_name'])) {
            $connectData['database_name'] = $input['database_name'];
        }

        if (! empty($input['storage_provider_id'])) {
            $connectData['storage_provider_id'] = $input['storage_provider_id'];
        }

        $resource = app(\App\Actions\SiteResource\ConnectSiteResource::class)->connect($site, $connectData);

        return [
            'resource_id' => $resource->id,
            'resource_type' => $resource->type->value,
        ];
    }
}
