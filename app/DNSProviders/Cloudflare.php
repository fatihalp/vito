<?php

namespace App\DNSProviders;

use App\Models\DNSProvider as DNSProviderModel;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class Cloudflare extends AbstractDNSProvider
{
    private const string API_BASE_URL = 'https://api.cloudflare.com/client/v4/';

    public function __construct(DNSProviderModel $dnsProvider)
    {
        parent::__construct($dnsProvider);
    }

    public static function id(): string
    {
        return 'cloudflare';
    }

    private function getClient(): PendingRequest
    {
        return Http::withHeaders([
            'Authorization' => 'Bearer '.$this->dnsProvider->credentials['token'],
            'Content-Type' => 'application/json',
        ])->baseUrl(self::API_BASE_URL);
    }

    public function validationRules(array $input): array
    {
        return [
            'token' => 'required|string',
        ];
    }

    public function credentialData(array $input): array
    {
        return [
            'token' => $input['token'],
        ];
    }

    public function editValidationRules(array $input): array
    {
        return [
            'token' => 'nullable|string',
        ];
    }

    public function mergeEditData(array $input): array
    {
        $credentials = $this->dnsProvider->credentials;
        $needsReconnect = false;

        if (! empty($input['token'])) {
            $credentials['token'] = $input['token'];
            $needsReconnect = true;
        }

        return [$credentials, $needsReconnect];
    }

    /**
     * Verifies the token can list zones, read records and create/delete a temporary TXT record.
     *
     * @throws ValidationException
     */
    public function connect(array $credentials): bool
    {
        $client = Http::withToken($credentials['token'])->acceptJson()->baseUrl(self::API_BASE_URL);

        try {
            $zones = $client->get('zones', ['per_page' => 1]);
            if (! $zones->successful()) {
                $this->failConnect('The token was rejected by Cloudflare'.$this->describeError($zones).'. Make sure you pasted the token value (not the token ID) and that the token is active and not expired.');
            }

            $zone = $zones->json('result.0');
            if (! $zone) {
                $this->failConnect('The token cannot see any zones. Add the "Zone > Zone > Read" permission and include your domains under "Zone Resources".');
            }

            $records = $client->get("zones/{$zone['id']}/dns_records", ['per_page' => 1]);
            if (! $records->successful()) {
                $this->failConnect("The token cannot read DNS records of {$zone['name']}".$this->describeError($records).'. Add the "Zone > DNS > Edit" permission.');
            }

            $created = $client->post("zones/{$zone['id']}/dns_records", [
                'type' => 'TXT',
                'name' => '_vito-permission-check.'.$zone['name'],
                'content' => 'vito-permission-check',
                'ttl' => 60,
            ]);
            if (! $created->successful()) {
                $this->failConnect("The token cannot create DNS records on {$zone['name']}".$this->describeError($created).'. Add the "Zone > DNS > Edit" permission. Note: "DNS Settings" is a different permission and is not enough.');
            }

            $deleted = $client->delete("zones/{$zone['id']}/dns_records/{$created->json('result.id')}");
            if (! $deleted->successful()) {
                $this->failConnect("The token created a test record but could not delete it".$this->describeError($deleted).". Remove the \"_vito-permission-check.{$zone['name']}\" TXT record manually and check the token's \"Zone > DNS > Edit\" permission.");
            }
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Cloudflare connection exception', ['error' => $e->getMessage()]);
            $this->failConnect('Could not reach the Cloudflare API: '.$e->getMessage());
        }

        return true;
    }

    /**
     * @throws ValidationException
     */
    private function failConnect(string $problem): never
    {
        throw ValidationException::withMessages([
            'token' => "Cloudflare token check failed: {$problem}\nFix the token in Cloudflare (My Profile > API Tokens > Edit), then try again.",
        ]);
    }

    private function describeError(Response $response): string
    {
        Log::error('Cloudflare token check failed', ['status' => $response->status(), 'errors' => $response->json('errors')]);

        $error = $response->json('errors')[0] ?? [];

        return sprintf(' (Cloudflare: %s, code %s, HTTP %d)', $error['message'] ?? 'Unknown error', $error['code'] ?? 'n/a', $response->status());
    }

    public function getDomains(): array
    {
        try {
            $response = $this->getClient()->get('zones', [
                'per_page' => 100,
            ]);

            if (! $response->successful()) {
                Log::error('Failed to fetch Cloudflare domains', ['response' => $response->json()]);

                return [];
            }

            return collect($response->json('result'))->map(function (array $zone) {
                return [
                    'id' => $zone['id'],
                    'name' => $zone['name'],
                    'status' => $zone['status'],
                    'created_on' => $zone['created_on'],
                    'modified_on' => $zone['modified_on'],
                ];
            })->toArray();
        } catch (Throwable $e) {
            Log::error('Cloudflare getDomains exception', ['error' => $e->getMessage()]);

            return [];
        }
    }

    public function getDomain(string $domainId): array
    {
        try {
            $response = $this->getClient()->get("zones/{$domainId}");

            if (! $response->successful()) {
                Log::error('Failed to fetch Cloudflare domain', ['domainId' => $domainId, 'response' => $response->json()]);

                return [];
            }

            $zone = $response->json('result');

            return [
                'id' => $zone['id'],
                'name' => $zone['name'],
                'status' => $zone['status'],
                'created_on' => $zone['created_on'],
                'modified_on' => $zone['modified_on'],
            ];
        } catch (Throwable $e) {
            Log::error('Cloudflare getDomain exception', ['error' => $e->getMessage()]);

            return [];
        }
    }

    public function getRecords(string $domainId): array
    {
        $response = $this->getClient()->get("zones/{$domainId}/dns_records", [
            'per_page' => 100,
        ]);

        if (! $response->successful()) {
            Log::error('Failed to fetch Cloudflare DNS records', ['domainId' => $domainId, 'response' => $response->json()]);
            throw new \RuntimeException('Failed to fetch DNS records: '.($response->json('errors')[0]['message'] ?? 'Unknown error'));
        }

        return collect($response->json('result'))->map(function (array $record) {
            return [
                'id' => $record['id'],
                'type' => $record['type'],
                'name' => $record['name'],
                'content' => $record['content'],
                'ttl' => $record['ttl'],
                'proxied' => $record['proxied'],
                'priority' => $record['type'] === 'MX' && isset($record['priority']) ? $record['priority'] : null,
                'created_on' => $record['created_on'],
                'modified_on' => $record['modified_on'],
            ];
        })->toArray();
    }

    public function createRecord(string $domainId, array $recordData): array
    {
        try {
            $response = $this->getClient()->post("zones/{$domainId}/dns_records", $this->buildPayload($recordData));

            if (! $response->successful()) {
                Log::error('Failed to create Cloudflare DNS record', ['domainId' => $domainId, 'input' => $recordData, 'response' => $response->json()]);
                $error = $response->json('errors')[0] ?? [];
                throw ValidationException::withMessages(['record' => sprintf(
                    "Failed to create DNS record: %s (Cloudflare code %s, HTTP %d).\nWhat to do: open your Cloudflare API token and make sure it has Zone > DNS > Edit permission and includes this domain's zone (and no IP restriction blocking this server). Then update the token in Settings > DNS Providers and try again.",
                    $error['message'] ?? 'Unknown error',
                    $error['code'] ?? 'n/a',
                    $response->status(),
                )]);
            }

            return $response->json('result');
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Cloudflare createRecord exception', ['error' => $e->getMessage()]);
            throw ValidationException::withMessages(['record' => 'Failed to create DNS record: '.$e->getMessage()]);
        }
    }

    public function updateRecord(string $domainId, string $recordId, array $recordData): array
    {
        try {
            $response = $this->getClient()->put("zones/{$domainId}/dns_records/{$recordId}", $this->buildPayload($recordData));

            if (! $response->successful()) {
                Log::error('Failed to update Cloudflare DNS record', ['domainId' => $domainId, 'recordId' => $recordId, 'input' => $recordData, 'response' => $response->json()]);
                throw ValidationException::withMessages(['record' => 'Failed to update DNS record: '.($response->json('errors')[0]['message'] ?? 'Unknown error')]);
            }

            return $response->json('result');
        } catch (Throwable $e) {
            Log::error('Cloudflare updateRecord exception', ['error' => $e->getMessage()]);
            throw ValidationException::withMessages(['record' => 'Failed to update DNS record: '.$e->getMessage()]);
        }
    }

    private function buildPayload(array $input): array
    {
        $payload = [
            'type' => $input['type'],
            'name' => $input['name'],
            'content' => $input['content'],
            'ttl' => $input['ttl'] ?? 1,
            'proxied' => $input['proxied'] ?? false,
        ];

        if (isset($input['priority'])) {
            $payload['priority'] = $input['priority'];
        }

        return $payload;
    }

    public function deleteRecord(string $domainId, string $recordId): bool
    {
        try {
            $response = $this->getClient()->delete("zones/{$domainId}/dns_records/{$recordId}");

            if (! $response->successful()) {
                Log::error('Failed to delete Cloudflare DNS record', ['domainId' => $domainId, 'recordId' => $recordId, 'response' => $response->json()]);

                return false;
            }

            return true;
        } catch (Throwable $e) {
            Log::error('Cloudflare deleteRecord exception', ['error' => $e->getMessage()]);

            return false;
        }
    }
}
