<?php

namespace App\Actions\SiteResource;

use App\Actions\Database\DeleteDatabase;
use App\Actions\Database\DeleteDatabaseUser;
use App\Actions\FirewallRule\ManageRule;
use App\Enums\SiteResourceType;
use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\FirewallRule;
use App\Models\SiteResource;
use Illuminate\Support\Facades\DB;

class DisconnectSiteResource
{
    public function __construct(private SyncManagedEnvironment $environment) {}

    public function disconnect(
        SiteResource $resource,
        bool $restoreEnvironment = true,
        bool $removeFirewall = true,
        bool $removeProvisioned = true,
    ): void
    {
        if ($removeProvisioned) {
            $this->removeProvisionedDatabase($resource);
        }

        DB::transaction(function () use ($resource, $restoreEnvironment, $removeFirewall): void {
            $site = $resource->site;
            $resource->delete();
            if ($restoreEnvironment) {
                $this->environment->sync($site, $resource);
            }

            if (! $removeFirewall) {
                return;
            }

            $firewallRuleId = $resource->configuration['firewall_rule_id'] ?? null;
            $firewallRule = $firewallRuleId ? FirewallRule::query()->find($firewallRuleId) : null;
            if ($firewallRule) {
                app(ManageRule::class)->delete($firewallRule);
            }
        });
    }

    private function removeProvisionedDatabase(SiteResource $resource): void
    {
        if ($resource->type !== SiteResourceType::DATABASE || ! $resource->server) {
            return;
        }

        $user = isset($resource->configuration['database_user_id'])
            ? DatabaseUser::query()->find($resource->configuration['database_user_id'])
            : null;
        if ($user) {
            app(DeleteDatabaseUser::class)->delete($resource->server, $user, allowManaged: true);
        }

        $database = isset($resource->configuration['database_id'])
            ? Database::query()->find($resource->configuration['database_id'])
            : null;
        if ($database) {
            app(DeleteDatabase::class)->delete($resource->server, $database, allowManaged: true);
        }
    }
}
