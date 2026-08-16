<?php

namespace App\Actions\HostedDomain;

use App\Enums\HostedDomainStatus;
use App\Enums\HostedDomainType;
use App\Enums\SslMethod;
use App\Jobs\HostedDomain\CheckDomainJob;
use App\Models\DNSProvider;
use App\Models\DNSRecord;
use App\Models\Domain;
use App\Models\HostedDomain;
use App\Models\Site;
use App\Models\Ssl;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class CreateHostedDomain
{
    /**
     * @param  array<string, mixed>  $input
     */
    public function create(Site $site, array $input): HostedDomain
    {
        $validated = $this->validate($site, $input);

        if (! empty($input['create_dns_record']) && ! empty($input['dns_provider_id']) && ! empty($input['provider_domain_id'])) {
            $this->createDnsRecord($site, $validated['domain'], $input);
        }

        $hostedDomain = new HostedDomain;
        $hostedDomain->site_id = $site->id;
        $hostedDomain->domain = $validated['domain'];
        $hostedDomain->type = $validated['type'];
        $hostedDomain->status = HostedDomainStatus::CREATING;
        $hostedDomain->ssl_method = SslMethod::from($validated['ssl_method']);
        $hostedDomain->ssl_id = $validated['ssl_method'] === SslMethod::CUSTOM->value ? (int) $validated['ssl_id'] : null;

        $hostedDomain->save();

        dispatch(new CheckDomainJob($hostedDomain))->onQueue('ssh');

        return $hostedDomain->refresh();
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function createDnsRecord(Site $site, string $domainName, array $input): void
    {
        $dnsProvider = DNSProvider::find($input['dns_provider_id']);
        if (! $dnsProvider) {
            return;
        }

        if (auth()->check() && user()->cannot('view', $dnsProvider)) {
            throw ValidationException::withMessages([
                'dns_provider_id' => ['Unauthorized access to DNS provider.'],
            ]);
        }

        $serverIp = $site->server?->ip;
        if (empty($serverIp)) {
            return;
        }

        $provider = $dnsProvider->provider();
        $zoneId = (string) $input['provider_domain_id'];

        try {
            $recordData = $provider->createRecord($zoneId, [
                'type' => 'A',
                'name' => $domainName,
                'content' => $serverIp,
                'ttl' => 1,
                'proxied' => (bool) ($input['dns_record_proxied'] ?? false),
            ]);

            $domainModel = Domain::where('dns_provider_id', $dnsProvider->id)
                ->where('provider_domain_id', $zoneId)
                ->first();

            if ($domainModel && isset($recordData['id'])) {
                DNSRecord::updateOrCreate(
                    [
                        'domain_id' => $domainModel->id,
                        'provider_record_id' => $recordData['id'],
                    ],
                    [
                        'type' => 'A',
                        'name' => $domainName,
                        'content' => $serverIp,
                        'ttl' => 1,
                        'proxied' => (bool) ($input['dns_record_proxied'] ?? false),
                        'metadata' => $recordData,
                    ]
                );
            }
        } catch (ValidationException $e) {
            $errorMessage = $e->getMessage();
            if (str_contains(strtolower($errorMessage), 'already exists')) {
                Log::info("DNS record for {$domainName} already exists on provider, proceeding.");

                return;
            }
            throw $e;
        } catch (Throwable $e) {
            if (str_contains(strtolower($e->getMessage()), 'already exists')) {
                Log::info("DNS record for {$domainName} already exists on provider, proceeding.");

                return;
            }
            Log::error('Failed to create DNS record on provider', ['error' => $e->getMessage()]);
            throw ValidationException::withMessages([
                'domain' => ['Failed to create DNS record on provider: '.$e->getMessage()],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function validate(Site $site, array $input): array
    {
        $rules = [
            'domain' => [
                'required',
                'string',
                'max:255',
                'regex:/^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/',
                function (string $attribute, mixed $value, \Closure $fail) use ($site): void {
                    $exists = HostedDomain::query()
                        ->where('domain', $value)
                        ->whereHas('site', fn ($q) => $q->where('server_id', $site->server_id))
                        ->exists();

                    if ($exists) {
                        $fail('This domain is already in use on this server.');
                    }
                },
            ],
            'type' => [
                'required',
                Rule::in([HostedDomainType::ALIAS->value, HostedDomainType::REDIRECT->value]),
            ],
            'ssl_method' => [
                'required',
                Rule::in(
                    $site->webserver()->allowedSslMethods()
                        ?? [SslMethod::NONE->value, SslMethod::LETSENCRYPT->value, SslMethod::CUSTOM->value]
                ),
            ],
            'ssl_id' => [
                Rule::requiredIf(($input['ssl_method'] ?? '') === SslMethod::CUSTOM->value),
                function (string $attribute, mixed $value, \Closure $fail) use ($site, $input): void {
                    if (($input['ssl_method'] ?? '') !== SslMethod::CUSTOM->value || empty($value)) {
                        return;
                    }

                    $ssl = Ssl::activeServerLevel($site->server_id)
                        ->where('id', $value)
                        ->first();

                    if (! $ssl) {
                        $fail('The selected SSL certificate is not valid.');
                    }
                },
            ],
            'dns_provider_id' => ['nullable', 'integer', 'exists:dns_providers,id'],
            'provider_domain_id' => ['nullable', 'string'],
            'create_dns_record' => ['nullable', 'boolean'],
            'dns_record_proxied' => ['nullable', 'boolean'],
        ];

        return Validator::make($input, $rules, [
            'ssl_id.required' => 'Please select an SSL certificate when using a custom certificate.',
        ])->validate();
    }
}
