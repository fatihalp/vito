<?php

namespace App\Jobs\SiteResource;

use App\Actions\SiteResource\SyncManagedEnvironment;
use App\Enums\FirewallRuleStatus;
use App\Enums\ServiceStatus;
use App\Enums\SiteResourceStatus;
use App\Enums\SiteResourceType;
use App\Models\FirewallRule;
use App\Models\Service;
use App\Models\SiteResource;
use App\Services\SupportsNetworking;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class FinalizeConnectionJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $tries = 30;

    public function __construct(protected SiteResource $resource) {}

    /** @return array<int, int> */
    public function backoff(): array
    {
        return [5, 10, 15, 30];
    }

    public function handle(): void
    {
        $this->run("site-resource-{$this->resource->id}", function (): void {
            $this->resource->refresh();

            if ($this->resource->status !== SiteResourceStatus::CONNECTING) {
                return;
            }

            $service = $this->service();
            $handler = $service?->hasHandler() ? $service->handler() : null;
            $firewallRule = $this->firewallRule();

            if (! $service || ! $handler instanceof SupportsNetworking || ! $firewallRule) {
                $this->failConnection();

                return;
            }

            if ($service->status === ServiceStatus::FAILED
                || $handler->networkingFailed()
                || $firewallRule?->status === FirewallRuleStatus::FAILED) {
                $this->failConnection();

                return;
            }

            $firewallReady = $firewallRule->status === FirewallRuleStatus::READY;
            if (! $handler->networkingEnabled() || ! $firewallReady) {
                $this->release(5);

                return;
            }

            $this->activateEnvironment();
        });
    }

    public function failed(Exception $exception): void
    {
        $resource = SiteResource::query()->find($this->resource->id);
        if (! $resource || $resource->status !== SiteResourceStatus::CONNECTING) {
            return;
        }

        $resource->status = SiteResourceStatus::FAILED;
        $resource->save();
    }

    private function service(): ?Service
    {
        return match ($this->resource->type) {
            SiteResourceType::DATABASE => $this->resource->server?->database(),
            SiteResourceType::CACHE => $this->resource->server?->memoryDatabase(),
            default => null,
        };
    }

    private function firewallRule(): ?FirewallRule
    {
        $id = $this->resource->configuration['firewall_rule_id'] ?? null;

        return $id ? FirewallRule::query()->find($id) : null;
    }

    private function failConnection(): void
    {
        $this->resource->status = SiteResourceStatus::FAILED;
        $this->resource->save();
    }

    private function activateEnvironment(): void
    {
        $this->resource->status = SiteResourceStatus::READY;
        $this->resource->save();

        try {
            app(SyncManagedEnvironment::class)->sync($this->resource->site);
        } catch (Throwable $exception) {
            $this->resource->status = SiteResourceStatus::CONNECTING;
            $this->resource->save();

            throw $exception;
        }
    }
}
