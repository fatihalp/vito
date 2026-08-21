<?php

namespace App\ServerProviders;

use App\DTOs\PrivateNetworkDTO;
use App\DTOs\PrivateNetworkMemberDTO;
use App\Enums\OperatingSystem;
use App\Exceptions\CouldNotConnectToProvider;
use App\Exceptions\PrivateNetworkSyncError;
use App\Exceptions\ServerProviderError;
use App\Facades\Notifier;
use App\Notifications\FailedToDeleteServerFromProvider;
use Exception;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class Vultr extends AbstractProvider implements ProvidesPrivateNetworks
{
    protected string $apiUrl = 'https://api.vultr.com/v2';

    public static function id(): string
    {
        return 'vultr';
    }

    public function instanceIdKey(): string
    {
        return 'instance_id';
    }

    
    public function privateNetworks(array $instanceIds, array $regions): array
    {
        $attachments = [];

        foreach ($instanceIds as $instanceId) {
            try {
                $attached = $this->fetchAll('/instances/'.$instanceId.'/vpcs', 'vpcs');
            } catch (PrivateNetworkSyncError $e) {
                if ($e->status === 404) {
                    continue;
                }

                throw $e;
            }

            foreach ($attached as $attachment) {
                $vpcId = (string) ($attachment['id'] ?? '');

                if ($vpcId === '') {
                    continue;
                }

                $attachments[$vpcId][] = new PrivateNetworkMemberDTO(
                    instanceId: (string) $instanceId,
                    ip: isset($attachment['ip_address']) ? (string) $attachment['ip_address'] : null,
                );
            }
        }

        if ($attachments === []) {
            return [];
        }

        return $this->mapPrivateNetworks($this->fetchAll('/vpcs', 'vpcs'), $attachments);
    }

    
    private function mapPrivateNetworks(array $vpcs, array $attachments): array
    {
        $result = [];

        foreach ($vpcs as $vpc) {
            $vpcId = (string) ($vpc['id'] ?? '');

            if (! isset($attachments[$vpcId])) {
                continue;
            }

            $subnet = $vpc['v4_subnet'] ?? null;
            $mask = $vpc['v4_subnet_mask'] ?? null;

            $result[] = new PrivateNetworkDTO(
                externalId: $vpcId,
                name: (string) ($vpc['description'] ?? $vpcId),
                cidr: is_string($subnet) && $subnet !== '' && is_numeric($mask) ? $subnet.'/'.(int) $mask : null,
                region: isset($vpc['region']) ? (string) $vpc['region'] : null,
                members: $attachments[$vpcId],
            );
        }

        return $result;
    }

    
    private function fetchAll(string $path, string $key): array
    {
        $token = $this->serverProvider->getCredentials()['token'];
        $items = [];
        $cursor = null;

        do {
            try {
                $response = Http::withToken($token)->get($this->apiUrl.$path, array_filter([
                    'per_page' => 500,
                    'cursor' => $cursor,
                ]));
            } catch (Exception) {
                throw $this->syncError();
            }

            if (! $response->ok()) {
                throw $this->syncError($response->status());
            }

            $body = $response->json();

            if (! is_array($body) || ! is_array($body[$key] ?? null)) {
                throw $this->syncError($response->status());
            }

            
            $batch = $body[$key];
            $items = array_merge($items, $batch);

            $next = $body['meta']['links']['next'] ?? null;

            if (! is_string($next) || $next === '') {
                break;
            }

            if ($next === $cursor) {
                throw $this->syncError();
            }

            $cursor = $next;
        } while (true);

        return $items;
    }

    public function createRules(array $input): array
    {
        return [
            'plan' => 'required',
            'region' => 'required',
        ];
    }

    public function credentialValidationRules($input): array
    {
        return [
            'token' => 'required',
        ];
    }

    public function credentialData($input): array
    {
        return [
            'token' => $input['token'],
        ];
    }

    public function data(array $input): array
    {
        return [
            'plan' => $input['plan'],
            'region' => $input['region'],
        ];
    }

    
    public function connect(array $credentials): bool
    {
        try {
            $connect = Http::withToken($credentials['token'])->get($this->apiUrl.'/account');
        } catch (Exception) {
            throw new CouldNotConnectToProvider('Vultr');
        }

        if (! $connect->ok()) {
            throw new CouldNotConnectToProvider('Vultr');
        }

        return true;
    }

    
    public function plans(?string $region): array
    {
        try {
            
            $response = Http::withToken($this->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/plans', ['per_page' => 500])
                ->json();

            
            $plans = $response['plans'] ?? [];

            return collect($plans)
                ->map(function (array $plan) use ($region): array {
                    $available = in_array($region, $plan['locations'], true);

                    $label = __('server_providers.plan', [
                        'name' => $plan['type'],
                        'cpu' => $plan['vcpu_count'],
                        'memory' => $plan['ram'],
                        'disk' => $plan['disk'],
                    ]);

                    if ($available) {
                        $label .= ' ('.number_format((float) $plan['monthly_cost'], 2).'/mo)';
                    }

                    return [
                        'id' => $plan['id'],
                        'label' => $label,
                        'available' => $available,
                    ];
                })
                ->sortByDesc('available')
                ->mapWithKeys(fn (array $value): array => [
                    $value['id'] => [
                        'label' => $value['label'],
                        'available' => $value['available'],
                    ],
                ])
                ->toArray();
        } catch (Exception) {
            return [];
        }
    }

    public function regions(): array
    {
        try {
            
            $regions = Http::withToken($this->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/regions', ['per_page' => 500])
                ->json();

            
            $regions = $regions['regions'] ?? [];

            return collect($regions)
                ->mapWithKeys(fn ($value) => [$value['id'] => $value['country'].' - '.$value['city']])
                ->toArray();
        } catch (Exception) {
            return [];
        }
    }

    
    public function create(): void
    {
        
        
        $storageDisk = Storage::disk(config('core.key_pairs_disk'));
        generate_key_pair($storageDisk->path((string) $this->server->id));

        try {
            $createSshKey = Http::withToken($this->server->serverProvider->credentials['token'])
                ->post($this->apiUrl.'/ssh-keys', [
                    'ssh_key' => $this->server->sshKey()['public_key'],
                    'name' => $this->server->name.'_'.$this->server->id,
                ]);
        } catch (Exception) {
            throw new ServerProviderError('Error creating SSH Key on Vultr');
        }

        if ($createSshKey->status() != 201) {
            throw new ServerProviderError('Error creating SSH Key on Vultr');
        }

        try {
            $create = Http::withToken($this->server->serverProvider->credentials['token'])
                ->post($this->apiUrl.'/instances', [
                    'label' => $this->server->name,
                    'region' => $this->server->provider_data['region'],
                    'plan' => $this->server->provider_data['plan'],
                    'os_id' => $this->getImageId($this->server->os),
                    'enable_ipv6' => false,
                    'sshkey_id' => [$createSshKey->json()['ssh_key']['id']],
                ]);
        } catch (Exception) {
            throw new ServerProviderError('Failed to create server on Vultr');
        }

        if ($create->status() != 202) {
            Log::error('Failed to create server on Vultr', $create->json());
            throw new ServerProviderError('Failed: '.$create->body());
        }
        $providerData = $this->server->provider_data;
        $providerData['instance_id'] = $create->json()['instance']['id'];
        $this->server->provider_data = $providerData;
        $this->server->save();
    }

    public function isRunning(): bool
    {
        try {
            $status = Http::withToken($this->server->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/instances/'.$this->server->provider_data['instance_id']);
        } catch (Exception) {
            return false;
        }

        if (! $status->ok()) {
            return false;
        }

        if (! $this->server->ip) {
            $this->server->ip = $status->json()['instance']['main_ip'];
            $this->server->save();
        }

        if (! $this->server->ip) {
            return false;
        }

        return $status->json()['instance']['status'] == 'active';
    }

    
    public function delete(): void
    {
        if (isset($this->server->provider_data['instance_id'])) {
            try {
                $delete = Http::withToken($this->server->serverProvider->credentials['token'])
                    ->delete($this->apiUrl.'/instances/'.$this->server->provider_data['instance_id']);
            } catch (Exception) {
                Notifier::send($this->server, new FailedToDeleteServerFromProvider($this->server));

                return;
            }

            if (! $delete->ok()) {
                Notifier::send($this->server, new FailedToDeleteServerFromProvider($this->server));
            }
        }
    }

    
    private function getImageId(OperatingSystem $os): int
    {
        $version = $os->getVersion();

        try {
            
            $result = Http::withToken($this->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/os', ['per_page' => 500])
                ->json();

            
            $os = $result['os'] ?? [];

            $image = collect($os)
                ->filter(fn (array $os): bool => str_contains((string) $os['name'], $version))
                ->where('family', 'ubuntu')
                ->where('arch', 'x64')
                ->first();

            return $image['id'];
        } catch (Exception) {
            throw new Exception('Could not find image ID');
        }
    }
}
