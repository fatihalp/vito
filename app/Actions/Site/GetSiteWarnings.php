<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Enums\HostedDomainStatus;
use App\Enums\SslStatus;
use App\Enums\WorkerStatus;
use App\Models\Site;
use App\SiteTypes\AbstractProxiedSiteType;

class GetSiteWarnings
{
    public function __construct(private CheckAppDebug $appDebug) {}

    public function get(Site $site): array
    {
        $warnings = [];

        $hostedDomains = $site->relationLoaded('hostedDomains') ? $site->hostedDomains : collect();

        $pendingDomains = $hostedDomains->where('status', HostedDomainStatus::PENDING);
        if ($pendingDomains->isNotEmpty()) {
            $warnings[] = [
                'key' => 'pending_domains',
                'count' => $pendingDomains->count(),
                'domains' => $pendingDomains->pluck('domain')->all(),
            ];
        }

        if (! $site->ssl_enabled) {
            $warnings[] = ['key' => 'ssl_disabled'];
        }

        if (! $site->vhost_generation_enabled) {
            $warnings[] = ['key' => 'vhost_generation_disabled'];
        }

        if ($site->vhost_template !== null
            && array_filter($site->phpSettings(), fn ($v) => $v !== null) !== []) {
            $warnings[] = ['key' => 'php_settings_ignored'];
        }

        $expiring = $hostedDomains->filter(
            fn ($hd) => $hd->ssl_id
                && $hd->relationLoaded('ssl')
                && $hd->ssl
                && $hd->ssl->status === SslStatus::CREATED
                && $hd->ssl->expires_at
                && $hd->ssl->expires_at <= now()->addDays(14)
        );

        if ($expiring->isNotEmpty()) {
            $earliestExpiry = $expiring->min(fn ($hd) => $hd->ssl->expires_at);
            $warnings[] = [
                'key' => 'ssl_expiring',
                'count' => $expiring->count(),
                'domains' => $expiring->pluck('domain')->all(),
                'earliest_expiry' => $earliestExpiry?->toIso8601String(),
            ];
        }

        if ($site->typeOrNull() instanceof AbstractProxiedSiteType
            && ! ($site->getAttribute('has_finished_deployment') ?? $site->deployments()->where('status', DeploymentStatus::FINISHED)->exists())) {
            $warnings[] = ['key' => 'needs_first_deploy'];
        }

        if ($site->type_data['composer_install_failed'] ?? false) {
            $warnings[] = ['key' => 'composer_install_failed'];
        }

        if ($this->appDebug->applies($site) && $this->appDebug->disabled($site) === false) {
            $warnings[] = ['key' => 'app_debug_enabled'];
        }

        if ($site->relationLoaded('workers')) {
            $bootstrapId = $site->bootstrapWorkerId();

            foreach ($site->workers as $worker) {
                $isBootstrap = $bootstrapId !== null && $worker->id === $bootstrapId;

                $inError = $worker->status === WorkerStatus::FAILED
                    || ($isBootstrap && $worker->status === WorkerStatus::STOPPED);

                if (! $inError) {
                    continue;
                }

                $warnings[] = [
                    'key' => 'worker_not_running',
                    'worker_id' => $worker->id,
                    'name' => $worker->name,
                    'status' => $worker->status->getText(),
                    'status_color' => $worker->status->getColor(),
                    'error' => $worker->error,
                ];
            }
        }

        return $warnings;
    }
}
