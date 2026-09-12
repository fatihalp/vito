<?php

namespace App\SiteTypes;

use App\Enums\LoadBalancerMethod;
use App\Exceptions\SSHError;
use App\Models\Site;
use Illuminate\Validation\Rule;

class LoadBalancer extends AbstractSiteType
{
    public static function id(): string
    {
        return 'load-balancer';
    }

    public function requiredServices(): array
    {
        return [
            'webserver',
        ];
    }

    public static function make(): self
    {
        return new self(new Site(['type' => self::id()]));
    }

    public function language(): string
    {
        return 'yaml';
    }

    public function createRules(array $input): array
    {
        return [
            'method' => [
                'required',
                Rule::in([
                    LoadBalancerMethod::IP_HASH->value,
                    LoadBalancerMethod::ROUND_ROBIN->value,
                    LoadBalancerMethod::LEAST_CONNECTIONS->value,
                ]),
            ],
        ];
    }

    public function data(array $input): array
    {
        return [
            'method' => $input['method'] ?? LoadBalancerMethod::ROUND_ROBIN->value,
        ];
    }

    
    public function install(): void
    {
        $this->step('isolating-user', 0, fn () => $this->isolate());
        $this->step('creating-vhost', 50, fn () => $this->site->webserver()->createVHost($this->site));
        $this->progress(90, 'finishing');
    }

    public function installationSteps(): array
    {
        return [
            ['key' => 'isolating-user', 'label' => 'Isolating User & Environment', 'percentage' => 0],
            ['key' => 'creating-vhost', 'label' => 'Configuring Web Server VHost', 'percentage' => 50],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 90],
        ];
    }

    public function vhostData(): array
    {
        return [
            'is_load_balancer' => true,
        ];
    }
}
