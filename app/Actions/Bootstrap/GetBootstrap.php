<?php

namespace App\Actions\Bootstrap;

use App\Enums\ServerRole;
use App\Models\GithubApp;
use App\Tooling\ToolingRegistry;
use Illuminate\Support\Facades\Cache;

final class GetBootstrap
{
    public const string VERSION_CACHE_KEY = 'bootstrap.version';

    
    private ?array $cachedConfigs = null;

    private ?string $cachedPublicKeyText = null;

    
    public function handle(): array
    {
        return [
            'version' => $this->version(),
            'configs' => $this->configs(),
            'public_key_text' => $this->publicKeyText(),
        ];
    }

    public function version(): string
    {
        if (! app()->isProduction()) {
            return $this->computeVersion();
        }

        return Cache::rememberForever(
            self::VERSION_CACHE_KEY,
            fn (): string => $this->computeVersion(),
        );
    }

    
    public function computeVersion(): string
    {
        return substr(md5(serialize($this->configs()).'|'.$this->publicKeyText()), 0, 16);
    }

    public static function forgetVersion(): void
    {
        Cache::forget(self::VERSION_CACHE_KEY);
    }

    
    private function configs(): array
    {
        return $this->cachedConfigs ??= [
            'operating_systems' => config('core.operating_systems'),
            'colors' => config('core.colors'),
            'cronjob_intervals' => config('core.cronjob_intervals'),
            'metrics_periods' => config('core.metrics_periods'),
            'server_roles' => array_map(fn (ServerRole $role): array => [
                'value' => $role->value,
                'label' => $role->getText(),
            ], ServerRole::cases()),
            'site' => [
                'types' => config('site.types'),
                'reserved_user_names' => config('core.reserved_user_names'),
            ],
            'source_control' => [
                'providers' => config('source-control.providers'),
            ],
            'server_provider' => [
                'providers' => config('server-provider.providers'),
            ],
            'storage_provider' => [
                'providers' => config('storage-provider.providers'),
            ],
            'bucket' => [
                'regions' => collect(config('hetzner-object-storage.regions'))
                    ->map(fn (string $label, string $value): array => ['value' => $value, 'label' => $label])
                    ->values()
                    ->all(),
            ],
            'notification_channel' => [
                'providers' => config('notification-channel.providers'),
            ],
            'service' => [
                'services' => config('service.services'),
            ],
            'dns_provider' => [
                'providers' => config('dns-provider.providers'),
            ],
            'github_app' => [
                'installed' => GithubApp::query()->exists(),
            ],
            'tooling' => $this->tooling(),
        ];
    }

    
    private function tooling(): array
    {
        $out = [];
        foreach (ToolingRegistry::all() as $tool) {
            $out[] = [
                'id' => $tool::id(),
                'label' => $tool::label(),
                'description' => $tool::description(),
                'supported_versions' => $tool::supportedVersions(),
                'commands' => $tool::commands(),
            ];
        }

        return $out;
    }

    private function publicKeyText(): string
    {
        return $this->cachedPublicKeyText ??= __('servers.create.public_key_text', ['public_key' => get_public_key_content()]);
    }
}
