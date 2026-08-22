<?php

namespace App\WorkflowActions\Site;

use App\Models\Server;
use App\Models\Site;
use App\WorkflowActions\AbstractWorkflowAction;
use Illuminate\Support\Facades\Validator;

abstract class CreateSite extends AbstractWorkflowAction
{
    public function inputs(): array
    {
        return [
            'server_id' => 'The ID of the server to create the site on',
            'domain' => 'The domain of the site (example.com)',
            'aliases' => [
                'alias-1',
                'alias-2',
                'send this field empty [] if you do not want to set any aliases',
            ],
            'user' => 'Isolated user, remove this field to auto-generate one from the domain',
            'dns_provider_id' => 'Connected DNS provider ID, omit to skip automatic DNS record creation',
            'provider_domain_id' => 'The zone ID for the domain on the DNS provider, required if dns_provider_id is set',
            'create_dns_record' => 'Whether to automatically point the domain at the server (true/false, optional)',
            'dns_record_proxied' => 'Whether the DNS record should be proxied (Cloudflare only, true/false, optional)',
        ];
    }

    public function outputs(): array
    {
        return [
            'site_id' => 'The ID of the created site',
            'site_domain' => 'The domain of the created site',
            'site_path' => 'The path of the created site on the server',
            'site_status' => 'The status of the created site',
        ];
    }

    public function run(array $input): array
    {
        Validator::make($input, [
            'server_id' => ['required', 'integer', 'exists:servers,id'],
        ])->validate();

        
        $server = Server::query()->findOrFail($input['server_id']);

        $this->authorize('create', [Site::class, $server]);

        $site = app(\App\Actions\Site\CreateSite::class)->create(
            $server,
            $input,
        );

        return [
            'site_id' => $site->id,
            'site_domain' => $site->domain,
            'site_path' => $site->path,
            'site_status' => $site->status->value,
        ];
    }
}
