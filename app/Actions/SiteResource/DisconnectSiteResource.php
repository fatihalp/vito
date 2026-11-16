<?php

namespace App\Actions\SiteResource;

use App\Actions\FirewallRule\ManageRule;
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
    ): void
    {
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
}
