<?php

namespace App\SiteTypes;

use App\Exceptions\SSHError;
use App\Models\Site;
use App\Traits\NormalizesWebDirectory;
use Illuminate\Validation\Rule;

class PHPBlank extends PHPSite
{
    use NormalizesWebDirectory;

    public static function id(): string
    {
        return 'php-blank';
    }

    public static function make(): self
    {
        return new self(new Site(['type' => self::id()]));
    }

    public function createRules(array $input): array
    {
        $rules = parent::createRules($input);

        unset($rules['source_control'], $rules['repository'], $rules['branch'], $rules['composer']);

        $rules['php_version'] = [
            'required',
            Rule::in($this->site->server->installedPHPVersions()),
        ];

        return $rules;
    }

    public function createFields(array $input): array
    {
        return [
            'web_directory' => $this->normalizeWebDirectory($input['web_directory'] ?? ''),
            'php_version' => $input['php_version'] ?? '',
        ];
    }

    public function data(array $input): array
    {
        $data = parent::data($input);
        unset($data['composer']);

        return $data;
    }

    
    public function install(): void
    {
        $this->step('isolating-user', 0, fn () => $this->isolate());
        $this->step('installing-tooling', 15, fn () => $this->setupRequestedTooling());
        $this->step('creating-vhost', 25, fn () => $this->site->webserver()->createVHost($this->site));
        $this->step('restarting-php', 55, fn () => $this->site->php()?->restart());
        $this->progress(90, 'finishing');
    }

    public function installationSteps(): array
    {
        return [
            ['key' => 'isolating-user', 'label' => 'Isolating User & Environment', 'percentage' => 0],
            ['key' => 'installing-tooling', 'label' => 'Installing Runtime Tooling', 'percentage' => 15],
            ['key' => 'creating-vhost', 'label' => 'Configuring Web Server VHost', 'percentage' => 25],
            ['key' => 'restarting-php', 'label' => 'Restarting PHP Runtime', 'percentage' => 55],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 90],
        ];
    }

    public function baseCommands(): array
    {
        return [];
    }
}
