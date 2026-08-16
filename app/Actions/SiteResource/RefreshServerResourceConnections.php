<?php

namespace App\Actions\SiteResource;

use App\Actions\Database\UpdateDatabaseUser;
use App\Actions\FirewallRule\ManageRule;
use App\Enums\SiteResourceType;
use App\Enums\SiteResourceStatus;
use App\Jobs\SiteResource\FinalizeConnectionJob;
use App\Models\FirewallRule;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\SiteResource;

class RefreshServerResourceConnections
{
    public function refresh(Server $server): void
    {
        $server->siteResources()
            ->with('site.server')
            ->get()
            ->each(function (SiteResource $resource) use ($server): void {
                $key = match ($resource->type) {
                    SiteResourceType::DATABASE => 'DB_HOST',
                    SiteResourceType::CACHE => 'REDIS_HOST',
                    SiteResourceType::BUCKET => null,
                };

                if ($key === null) {
                    return;
                }

                $environment = $resource->environment;
                $environment[$key] = $this->host($server);
                if ($resource->type === SiteResourceType::CACHE) {
                    $environment['REDIS_PASSWORD'] = (string) $server->memoryDatabase()?->secret;
                }
                $resource->environment = $environment;
                $resource->status = SiteResourceStatus::CONNECTING;
                $resource->save();
                dispatch(new FinalizeConnectionJob($resource))->onQueue('ssh');
            });

        $server->sites()
            ->with('resources')
            ->get()
            ->flatMap(fn ($site) => $site->resources)
            ->each(function (SiteResource $resource) use ($server): void {
                if ($resource->type === SiteResourceType::DATABASE) {
                    $databaseUserId = $resource->configuration['database_user_id'] ?? null;
                    $databaseUser = $databaseUserId ? DatabaseUser::query()->find($databaseUserId) : null;

                    if ($databaseUser) {
                        app(UpdateDatabaseUser::class)->updateManagedHost($databaseUser, $this->host($server));
                    }
                }

                $firewallRuleId = $resource->configuration['firewall_rule_id'] ?? null;
                $rule = $firewallRuleId ? FirewallRule::query()->find($firewallRuleId) : null;

                if (! $rule) {
                    return;
                }

                app(ManageRule::class)->update($rule, [
                    'name' => $rule->name,
                    'type' => $rule->type,
                    'protocol' => $rule->protocol,
                    'port' => $rule->port,
                    'source_any' => false,
                    'source' => $this->host($server),
                    'mask' => str_contains($this->host($server), ':') ? 128 : 32,
                ]);
                $resource->status = SiteResourceStatus::CONNECTING;
                $resource->save();
                dispatch(new FinalizeConnectionJob($resource))->onQueue('ssh');
            });
    }

    private function host(Server $server): string
    {
        return $server->local_ip ?: $server->ip;
    }
}
