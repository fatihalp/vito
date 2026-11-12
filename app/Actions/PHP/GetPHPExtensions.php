<?php

namespace App\Actions\PHP;

use App\Models\Service;
use Illuminate\Support\Facades\Validator;

class GetPHPExtensions
{
    public function handle(Service $service): array
    {
        Validator::make(['type' => $service->type], ['type' => ['required', 'in:php']])->validate();

        $output = $service->server->ssh()->exec(
            view('ssh.services.php.get-php-extensions', ['version' => $service->version]),
            'get-php-extensions',
        );

        $extensions = array_map(
            fn (string $extension): string => strtolower(preg_replace('/^Zend /', '', $extension)),
            json_decode(trim($output), true, flags: JSON_THROW_ON_ERROR),
        );
        sort($extensions);

        return array_values(array_unique($extensions));
    }
}
