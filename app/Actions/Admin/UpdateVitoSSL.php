<?php

namespace App\Actions\Admin;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateVitoSSL
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function update(array $input): void
    {
        $this->validate($input);

        $ssl = (bool) ($input['ssl'] ?? false);
        $domain = $input['domain'] ?? '';
        $email = $input['email'] ?? '';

        $this->updateEnv('VITO_SSL', $ssl ? 'true' : 'false');
        $this->updateEnv('VITO_DOMAIN', $domain);

        if ($ssl && $domain) {
            $scheme = 'https';
            $this->updateEnv('APP_URL', "{$scheme}://{$domain}");
        }

        Artisan::call('vito:generate-caddyfile');

        exec('sudo supervisorctl restart octane 2>/dev/null');
    }

    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    private function validate(array $input): void
    {
        $rules = [
            'ssl' => ['required', 'boolean'],
            'domain' => ['required_if:ssl,true', 'nullable', 'string'],
            'email' => ['required_if:ssl,true', 'nullable', 'email'],
        ];

        Validator::make($input, $rules)->validate();
    }

    private function updateEnv(string $key, string $value): void
    {
        $envPath = base_path('.env');

        if (! file_exists($envPath)) {
            return;
        }

        $content = file_get_contents($envPath);

        if (preg_match("/^{$key}=.*/m", $content)) {
            $content = preg_replace("/^{$key}=.*/m", "{$key}={$value}", $content);
        } else {
            $content .= "\n{$key}={$value}";
        }

        file_put_contents($envPath, $content);
    }
}
