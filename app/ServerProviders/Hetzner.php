<?php

namespace App\ServerProviders;

use App\DTOs\PrivateNetworkDTO;
use App\DTOs\PrivateNetworkMemberDTO;
use App\Exceptions\CouldNotConnectToProvider;
use App\Exceptions\PrivateNetworkSyncError;
use App\Exceptions\ServerProviderError;
use App\Facades\Notifier;
use App\Notifications\FailedToDeleteServerFromProvider;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class Hetzner extends AbstractProvider implements ProvidesPrivateNetworks
{
    protected string $apiUrl = 'https://api.hetzner.cloud/v1';

    public static function id(): string
    {
        return 'hetzner';
    }

    public function instanceIdKey(): string
    {
        return 'hetzner_id';
    }

    public function privateNetworks(array $instanceIds, array $regions): array
    {
        return $this->mapPrivateNetworks(
            $this->fetchAll('/networks', 'networks'),
            $this->fetchAll('/servers', 'servers'),
            $instanceIds,
        );
    }

    
    private function mapPrivateNetworks(array $networks, array $servers, array $instanceIds): array
    {
        $wanted = array_flip($instanceIds);
        $ips = [];

        foreach ($servers as $server) {
            $serverId = (string) ($server['id'] ?? '');

            foreach ($server['private_net'] ?? [] as $attachment) {
                if (isset($attachment['network'], $attachment['ip'])) {
                    $ips[(string) $attachment['network']][$serverId] = (string) $attachment['ip'];
                }
            }
        }

        $result = [];

        foreach ($networks as $network) {
            $networkId = (string) ($network['id'] ?? '');
            $members = [];

            foreach ($network['servers'] ?? [] as $attachedId) {
                $attachedId = (string) $attachedId;

                if (! isset($wanted[$attachedId])) {
                    continue;
                }

                $members[] = new PrivateNetworkMemberDTO(
                    instanceId: $attachedId,
                    ip: $ips[$networkId][$attachedId] ?? null,
                );
            }

            if ($members === []) {
                continue;
            }

            $result[] = new PrivateNetworkDTO(
                externalId: $networkId,
                name: (string) ($network['name'] ?? $networkId),
                cidr: isset($network['ip_range']) ? (string) $network['ip_range'] : null,
                region: isset($network['subnets'][0]['network_zone'])
                    ? (string) $network['subnets'][0]['network_zone']
                    : null,
                members: $members,
            );
        }

        return $result;
    }

    
    private function fetchAll(string $path, string $key): array
    {
        $token = $this->serverProvider->getCredentials()['token'];
        $items = [];
        $page = 1;

        do {
            try {
                $response = Http::withToken($token)->get($this->apiUrl.$path, [
                    'per_page' => 50,
                    'page' => $page,
                ]);
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

            $next = $body['meta']['pagination']['next_page'] ?? null;

            if ($next === null) {
                break;
            }

            if (! is_numeric($next) || (int) $next <= $page) {
                throw $this->syncError();
            }

            $page = (int) $next;
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

    public function credentialValidationRules(array $input): array
    {
        return [
            'token' => 'required',
        ];
    }

    public function credentialData(array $input): array
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
        $connect = Http::withToken($credentials['token'])->get($this->apiUrl.'/servers');
        if (! $connect->ok()) {
            throw new CouldNotConnectToProvider('Hetzner');
        }

        return true;
    }

    
    public function plans(?string $region): array
    {
        try {
            
            $plans = Http::withToken($this->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/server_types', ['per_page' => 50])
                ->json();

            
            $serverTypes = $plans['server_types'] ?? [];

            return collect($serverTypes)
                ->map(function (array $type) use ($region): ?array {
                    
                    $location = collect($type['locations'])->firstWhere('name', $region);

                    if (! $location) {
                        return null;
                    }

                    $available = $this->planIsAvailable($location);

                    $label = __('server_providers.plan', [
                        'name' => $type['name'],
                        'cpu' => $type['cores'],
                        'memory' => $type['memory'],
                        'disk' => $type['disk'],
                    ]);

                    if ($available) {
                        $price = $this->planMonthlyPrice($type, $region);

                        if ($price !== null) {
                            $label .= ' ('.number_format($price, 2).'/mo)';
                        }
                    }

                    return [
                        'name' => $type['name'],
                        'label' => $label,
                        'available' => $available,
                    ];
                })
                ->filter()
                ->sortByDesc('available')
                ->mapWithKeys(fn (array $plan): array => [
                    $plan['name'] => [
                        'label' => $plan['label'],
                        'available' => $plan['available'],
                    ],
                ])
                ->toArray();
        } catch (Exception) {
            return [];
        }
    }

    
    private function planIsAvailable(array $location): bool
    {
        if (! ($location['available'] ?? false)) {
            return false;
        }

        $unavailableAfter = $location['deprecation']['unavailable_after'] ?? null;

        if ($unavailableAfter === null) {
            return true;
        }

        return Carbon::parse($unavailableAfter)->isFuture();
    }

    
    private function planMonthlyPrice(array $type, ?string $region): ?float
    {
        
        $price = collect($type['prices'])->firstWhere('location', $region);

        if ($price === null) {
            return null;
        }

        return (float) $price['price_monthly']['net'];
    }

    public function regions(): array
    {
        try {
            $regions = Http::withToken($this->serverProvider->credentials['token'])
                ->get($this->apiUrl.'/locations', ['per_page' => 50])
                ->json();

            
            $locations = $regions['locations'];

            return collect($locations)
                ->mapWithKeys(fn (array $value): array => [$value['name'] => $value['city'].' - '.$value['country']])
                ->toArray();
        } catch (Exception) {
            return [];
        }
    }

    
    public function create(): void
    {
        $this->generateKeyPair();

        $token = $this->server->serverProvider->credentials['token'];
        $publicKey = trim($this->server->sshKey()['public_key']);

        $keyId = $this->getOrCreateSshKeyId($token, $publicKey);

        $this->server->jsonUpdate('provider_data', 'ssh_key_id', $keyId);

        $create = Http::withToken($this->server->serverProvider->credentials['token'])
            ->post($this->apiUrl.'/servers', [
                'automount' => false,
                'image' => config('serverproviders.hetzner.images')[$this->server->os->value],
                
                'ssh_keys' => [
                    $keyId,
                ],
                'name' => str($this->server->name)->slug(),
                'location' => $this->server->provider_data['region'],
                'server_type' => $this->server->provider_data['plan'],
            ]);
        if ($create->status() != 201) {
            $this->providerError($create);
        }
        $this->server->jsonUpdate('provider_data', 'hetzner_id', $create->json()['server']['id'], false);
        $this->server->ip = $create->json()['server']['public_net']['ipv4']['ip'];
        $this->server->save();
    }

    
    public function isRunning(): bool
    {
        if (empty($this->server->provider_data['hetzner_id'])) {
            return false;
        }

        $status = Http::withToken($this->server->serverProvider->credentials['token'])
            ->get($this->apiUrl.'/servers/'.$this->server->provider_data['hetzner_id']);

        if (! $status->ok()) {
            return false;
        }

        return $status->json()['server']['status'] == 'running';
    }

    public function canPowerManage(): bool
    {
        return ! empty($this->server->provider_data['hetzner_id']) && ! empty($this->server->serverProvider?->credentials['token']);
    }

    
    public function stop(): void
    {
        if (isset($this->server->provider_data['hetzner_id'])) {
            $response = Http::withToken($this->server->serverProvider->credentials['token'])
                ->post($this->apiUrl.'/servers/'.$this->server->provider_data['hetzner_id'].'/actions/poweroff');

            if (! $response->successful() && $response->status() !== 404) {
                $this->providerError($response);
            }
        }
    }

    
    public function start(): void
    {
        if (isset($this->server->provider_data['hetzner_id'])) {
            $response = Http::withToken($this->server->serverProvider->credentials['token'])
                ->post($this->apiUrl.'/servers/'.$this->server->provider_data['hetzner_id'].'/actions/poweron');

            if (! $response->successful() && $response->status() !== 404) {
                $this->providerError($response);
            }
        }
    }

    
    public function delete(): void
    {
        if (isset($this->server->provider_data['hetzner_id'])) {
            $delete = Http::withToken($this->server->serverProvider->credentials['token'])
                ->delete($this->apiUrl.'/servers/'.$this->server->provider_data['hetzner_id']);

            if (! $delete->ok()) {
                Notifier::send($this->server, new FailedToDeleteServerFromProvider($this->server));
            }
        }

        
        if (isset($this->server->provider_data['ssh_key_id'])) {
            Http::withToken($this->server->serverProvider->credentials['token'])
                ->delete($this->apiUrl.'/ssh_keys/'.$this->server->provider_data['ssh_key_id']);
        }
    }

    
    private function providerError(Response $response): never
    {
        throw new ServerProviderError($response->json('error.message') ?? __('Hetzner request failed with status :status', ['status' => $response->status()]));
    }

    
    private function getOrCreateSshKeyId(string $token, string $publicKey): int
    {
        $keyName = 'server-'.$this->server->id.'-key';

        $pubParts = explode(' ', trim($publicKey));
        $targetBase64 = $pubParts[1] ?? trim($publicKey);

        $response = Http::withToken($token)->get($this->apiUrl.'/ssh_keys', ['per_page' => 100]);
        $existingKeys = $response->json('ssh_keys') ?? [];

        foreach ($existingKeys as $key) {
            $keyPubParts = explode(' ', trim($key['public_key'] ?? ''));
            $keyBase64 = $keyPubParts[1] ?? trim($key['public_key'] ?? '');

            if ($keyBase64 !== '' && $keyBase64 === $targetBase64) {
                return (int) $key['id'];
            }

            if (($key['name'] ?? '') === $keyName) {
                Http::withToken($token)->delete($this->apiUrl.'/ssh_keys/'.$key['id']);
            }
        }

        $createRes = Http::withToken($token)->post($this->apiUrl.'/ssh_keys', [
            'name' => $keyName,
            'public_key' => $publicKey,
        ]);

        if ($createRes->status() === 201) {
            return (int) $createRes->json('ssh_key.id');
        }

        if ($createRes->status() === 422) {
            $fallbackName = $keyName.'-'.str()->random(6);
            $fallbackRes = Http::withToken($token)->post($this->apiUrl.'/ssh_keys', [
                'name' => $fallbackName,
                'public_key' => $publicKey,
            ]);

            if ($fallbackRes->status() === 201) {
                return (int) $fallbackRes->json('ssh_key.id');
            }

            $reFetch = Http::withToken($token)->get($this->apiUrl.'/ssh_keys', ['per_page' => 100]);
            foreach ($reFetch->json('ssh_keys') ?? [] as $key) {
                $keyPubParts = explode(' ', trim($key['public_key'] ?? ''));
                $keyBase64 = $keyPubParts[1] ?? trim($key['public_key'] ?? '');
                if ($keyBase64 !== '' && $keyBase64 === $targetBase64) {
                    return (int) $key['id'];
                }
            }

            $this->providerError($fallbackRes);
        }

        $this->providerError($createRes);
    }
}
