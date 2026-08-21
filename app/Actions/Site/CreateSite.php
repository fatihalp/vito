<?php

namespace App\Actions\Site;

use App\Actions\Domain\CreateDnsARecordForServer;
use App\Enums\HostedDomainStatus;
use App\Enums\HostedDomainType;
use App\Enums\ServerRole;
use App\Enums\SiteStatus;
use App\Exceptions\RepositoryNotFound;
use App\Exceptions\RepositoryPermissionDenied;
use App\Exceptions\SourceControlIsNotConnected;
use App\Jobs\Site\CreateJob;
use App\Models\IsolatedUser;
use App\Models\Server;
use App\Models\Service;
use App\Models\Site;
use App\Services\Webserver\Webserver;
use App\Tooling\ToolingRegistry;
use App\ValidationRules\DomainRule;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class CreateSite
{
    private const ISOLATED_USER_PATTERN = '/^[a-z_][a-z0-9_-]*[a-z0-9]$/';

    
    public function create(Server $server, array $input): Site
    {
        if ($server->role !== ServerRole::APP) {
            throw ValidationException::withMessages([
                'server' => __('Sites can only be created on app servers.'),
            ]);
        }

        if (empty($input['user']) || ! is_string($input['user'])) {
            $input['user'] = $this->generateIsolatedUsername($server, is_string($input['domain'] ?? null) ? $input['domain'] : '');
        }

        $input = $this->lockRuntimeVersionsToExistingUser($server, $input);

        $this->validate($server, $input);

        DB::beginTransaction();
        try {
            $user = $input['user'];

            $isolatedUser = $user !== $server->getSshUser()
                ? IsolatedUser::query()->firstOrCreate(
                    ['server_id' => $server->id, 'username' => $user],
                )
                : null;

            $site = new Site([
                'server_id' => $server->id,
                'isolated_user_id' => $isolatedUser?->id,
                'type' => $input['type'],
                'domain' => $input['domain'],
                'user' => $user,
                'path' => '/home/'.$user.'/'.$input['domain'],
                'status' => SiteStatus::INSTALLING,
            ]);

            foreach ($site->type()->requiredServices() as $requiredService) {
                if (! $server->service($requiredService)) {
                    throw ValidationException::withMessages([
                        'type' => "The site type requires a {$requiredService} service to be installed.",
                    ]);
                }
            }

            
            $site->fill($site->type()->createFields($input));

            
            $webserver = $server->webserver();
            
            $webserverHandler = $webserver->handler();
            $site->fill($webserverHandler->siteDefaults());

            
            try {
                if ($site->sourceControl) {
                    $site->sourceControl->getRepo($site->repository);
                }
            } catch (SourceControlIsNotConnected) {
                throw ValidationException::withMessages([
                    'source_control' => 'Source control is not connected',
                ]);
            } catch (RepositoryPermissionDenied) {
                throw ValidationException::withMessages([
                    'repository' => 'You do not have permission to access this repository',
                ]);
            } catch (RepositoryNotFound) {
                throw ValidationException::withMessages([
                    'repository' => 'Repository not found',
                ]);
            }

            
            $site->type_data = $site->type()->data($input);

            
            $site->save();

            $defaultSslMethod = $webserverHandler->defaultSslMethod();

            app(CreateDnsARecordForServer::class)->createIfRequested($server, $site->domain, $input);

            $site->hostedDomains()->create([
                'domain' => $site->domain,
                'type' => HostedDomainType::PRIMARY,
                'status' => HostedDomainStatus::CREATING,
                'ssl_method' => $defaultSslMethod,
            ]);

            foreach ($input['aliases'] ?? [] as $alias) {
                $site->hostedDomains()->create([
                    'domain' => $alias,
                    'type' => HostedDomainType::ALIAS,
                    'status' => HostedDomainStatus::CREATING,
                    'ssl_method' => $defaultSslMethod,
                ]);
            }

            
            $site->commands()->createMany($site->type()->baseCommands());

            DB::commit();

            dispatch(new CreateJob($site));

            return $site;
        } catch (Exception $e) {
            DB::rollBack();
            throw ValidationException::withMessages([
                'type' => $e->getMessage(),
            ]);
        }
    }

    private function validate(Server $server, array $input): void
    {
        $rules = [
            'type' => [
                'required',
                Rule::in(array_keys(config('site.types'))),
            ],
            'domain' => [
                'required',
                new DomainRule,
                Rule::unique('sites', 'domain')->where(fn ($query) => $query->where('server_id', $server->id)),
            ],
            'aliases.*' => [
                new DomainRule,
            ],
            'user' => [
                'required',
                'regex:'.self::ISOLATED_USER_PATTERN,
                'min:3',
                'max:32',
                Rule::notIn(array_unique(array_merge(
                    config('core.reserved_user_names'),
                    [$server->getSshUser()]
                ))),
            ],
            'dns_provider_id' => ['nullable', 'integer', 'exists:dns_providers,id'],
            'provider_domain_id' => ['nullable', 'string'],
            'create_dns_record' => ['nullable', 'boolean'],
            'dns_record_proxied' => ['nullable', 'boolean'],
        ];

        Validator::make($input, array_merge($rules, $this->typeRules($server, $input)))->validate();
    }

    
    private function typeRules(Server $server, array $input): array
    {
        if (! isset($input['type']) || ! config('site.types.'.$input['type'])) {
            return [];
        }

        $site = new Site([
            'server_id' => $server->id,
            'type' => $input['type']]
        );

        return $site->type()->createRules($input);
    }

    
    private function generateIsolatedUsername(Server $server, string $domain): string
    {
        $slug = strtolower($domain);
        $slug = preg_replace('/^https?:\/\//', '', $slug) ?? $slug;
        $slug = preg_replace('/^www\./', '', $slug) ?? $slug;
        $slug = preg_replace('/[^a-z0-9]/', '', $slug) ?? $slug;
        $slug = preg_replace('/^\d+/', '', $slug) ?? $slug;

        $base = substr($slug, 0, 6);

        if ($base === '') {
            $base = 'site';
        }

        $blocked = array_unique(array_merge(
            config('core.reserved_user_names'),
            [$server->getSshUser()],
            $server->isolatedUsers()->pluck('username')->all(),
        ));

        for ($i = 0; $i < 1000; $i++) {
            $candidate = $i === 0 ? $base : $base.$i;
            $length = strlen($candidate);

            if ($length < 3 || $length > 32 || in_array($candidate, $blocked, true)) {
                continue;
            }

            return $candidate;
        }

        throw ValidationException::withMessages([
            'domain' => __('Could not derive an available isolated username for this domain.'),
        ]);
    }

    
    private function lockRuntimeVersionsToExistingUser(Server $server, array $input): array
    {
        $user = isset($input['user']) && is_string($input['user']) ? $input['user'] : '';

        if ($user === '' || preg_match(self::ISOLATED_USER_PATTERN, $user) !== 1) {
            return $input;
        }

        $iuser = IsolatedUser::query()
            ->where('server_id', $server->id)
            ->where('username', $user)
            ->first();

        if (! $iuser instanceof IsolatedUser) {
            return $input;
        }

        foreach (ToolingRegistry::all() as $id => $tool) {
            $allowed = $tool::supportedVersionsWithNone();
            $existing = $iuser->toolingVersion($id);

            if ($existing === null || ! in_array($existing, $allowed, true) || $existing === 'none') {
                continue;
            }

            $field = $tool::typeDataKey();
            $submitted = $input[$field] ?? null;

            if (is_string($submitted) && $submitted !== '' && $submitted !== $existing) {
                throw ValidationException::withMessages([
                    $field => "Isolated user '{$user}' already has {$tool::label()} {$existing} installed; this cannot be changed.",
                ]);
            }

            $input[$field] = $existing;
        }

        return $input;
    }
}
