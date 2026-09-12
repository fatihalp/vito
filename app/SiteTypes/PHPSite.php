<?php

namespace App\SiteTypes;

use App\Exceptions\FailedToDeployGitKey;
use App\Exceptions\SSHError;
use App\Models\Site;
use App\Models\SourceControl;
use App\SSH\OS\Composer;
use App\Tooling\NodeTooling;
use App\Tooling\PnpmTooling;
use App\Tooling\ToolingRegistry;
use App\Tooling\YarnTooling;
use App\Traits\NormalizesWebDirectory;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class PHPSite extends AbstractSiteType
{
    use NormalizesWebDirectory;

    public static function id(): string
    {
        return 'php';
    }

    public function language(): string
    {
        return 'php';
    }

    public function requiredServices(): array
    {
        return [
            'php',
            'webserver',
        ];
    }

    public static function make(): self
    {
        return new self(new Site(['type' => self::id()]));
    }

    public static function createTimeTools(): array
    {
        return ['node', 'pnpm', 'yarn', 'composer'];
    }

    public static function requiredTooling(): array
    {
        return ['composer'];
    }

    public static function supportsTooling(): bool
    {
        return true;
    }

    public function createRules(array $input): array
    {
        $rules = [
            'php_version' => [
                'required',
                Rule::in($this->site->server->installedPHPVersions()),
            ],
            'source_control' => SourceControl::siteValidationRules($this->site->server),
            'web_directory' => [
                'nullable',
                'string',
                'max:255',
                'regex:/^[a-zA-Z0-9._\-\/]+$/',
                'not_regex:/\.\./',
            ],
            'repository' => [
                'required',
            ],
            'branch' => [
                'required',
            ],
            'composer' => [
                'nullable',
            ],
        ];

        foreach (static::createTimeTools() as $toolId) {
            $tool = ToolingRegistry::find($toolId);
            if (! $tool) {
                continue;
            }
            $rules[$tool::typeDataKey()] = [
                'nullable',
                Rule::in($tool::supportedVersionsWithNone()),
            ];
        }

        $rules['package_manager'] = [
            'nullable',
            Rule::in(['none', NodeTooling::id(), PnpmTooling::id(), YarnTooling::id()]),
        ];

        return $rules;
    }

    public function createFields(array $input): array
    {
        return [
            'web_directory' => $this->normalizeWebDirectory($input['web_directory'] ?? ''),
            'source_control_id' => $input['source_control'] ?? '',
            'repository' => $input['repository'] ?? '',
            'branch' => $input['branch'] ?? '',
            'php_version' => $input['php_version'] ?? '',
        ];
    }

    public function data(array $input): array
    {
        $data = [
            
            'composer' => ! isset($input['composer']) || (bool) $input['composer'],
        ];

        $packageManager = $input['package_manager'] ?? 'none';

        foreach (static::createTimeTools() as $toolId) {
            $tool = ToolingRegistry::find($toolId);
            if (! $tool) {
                continue;
            }
            $key = $tool::typeDataKey();

            if (in_array($toolId, static::requiredTooling(), true)) {
                $data[$key] = $tool::supportedVersions()[0] ?? 'none';
            } elseif ($toolId === $packageManager) {
                $data[$key] = $input[$key] ?? $tool::supportedVersions()[0];
            } else {
                $data[$key] = 'none';
            }
        }

        return $data;
    }

    
    public function install(): void
    {
        $this->step('isolating-user', 0, fn () => $this->isolate());
        $this->step('installing-tooling', 15, fn () => $this->setupRequestedTooling());
        $this->step('creating-vhost', 20, fn () => $this->site->webserver()->createVHost($this->site));
        $this->step('deploying-ssh-key', 25, fn () => $this->deployKey());
        $this->step('cloning-repository', 40, fn () => $this->cloneRepository());
        $this->step('restarting-php', 60, fn () => $this->site->php()?->restart());
        $this->step('installing-composer-dependencies', 75, function () {
            if ($this->site->type_data['composer'] ?? true) {
                $this->installComposerDependencies();
            }
        });
        $this->progress(90, 'finishing');
    }

    public function installationSteps(): array
    {
        return [
            ['key' => 'isolating-user', 'label' => 'Isolating User & Environment', 'percentage' => 0],
            ['key' => 'installing-tooling', 'label' => 'Installing Runtime Tooling', 'percentage' => 15],
            ['key' => 'creating-vhost', 'label' => 'Configuring Web Server VHost', 'percentage' => 20],
            ['key' => 'deploying-ssh-key', 'label' => 'Deploying Repository SSH Key', 'percentage' => 25],
            ['key' => 'cloning-repository', 'label' => 'Cloning Source Code', 'percentage' => 40],
            ['key' => 'restarting-php', 'label' => 'Restarting PHP Runtime', 'percentage' => 60],
            ['key' => 'installing-composer-dependencies', 'label' => 'Installing Composer Dependencies', 'percentage' => 75],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 90],
        ];
    }

    
    private function installComposerDependencies(): void
    {
        $override = $this->site->type_data['composer_install_command'] ?? null;

        try {
            app(Composer::class)->installDependencies($this->site, is_string($override) ? $override : null);
        } catch (SSHError $e) {
            Log::warning("Composer install failed during installation of site #{$this->site->id}: {$e->getMessage()}");
            $this->site->jsonUpdate('type_data', 'composer_install_failed', true);
        }
    }

    public function baseCommands(): array
    {
        return [
            [
                'name' => 'composer:install',
                'command' => 'composer install --no-dev --no-interaction --no-progress',
            ],
        ];
    }

    public function vhostData(): array
    {
        return [
            'is_php' => true,
        ];
    }
}
