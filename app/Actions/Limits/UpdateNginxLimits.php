<?php

namespace App\Actions\Limits;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class UpdateNginxLimits
{
    public function update(Server $server, array $input): void
    {
        $validated = $this->validate($input);

        $clientMaxBodySize = $this->normalizeSize($validated['client_max_body_size']);

        try {
            $server->ssh('root')->exec(
                view('ssh.services.webserver.nginx.update-nginx-limits', [
                    'client_max_body_size' => $clientMaxBodySize,
                ]),
                'update-nginx-limits'
            );
        } catch (Throwable $e) {
            throw ValidationException::withMessages([
                'client_max_body_size' => __('Failed to apply Nginx limits: :message', [
                    'message' => $e->getMessage(),
                ]),
            ]);
        }
    }

    private function validate(array $input): array
    {
        return Validator::make($input, [
            'client_max_body_size' => [
                'required',
                'regex:/^(0|[1-9]\d*[kKmMgG]?)$/',
            ],
        ], [
            'client_max_body_size.regex' => __('Please provide a valid size (e.g., 210M, 500M, 1G, or 0 for unlimited).'),
        ])->validate();
    }

    private function normalizeSize(string $size): string
    {
        $size = trim($size);
        if ($size === '0') {
            return '0';
        }

        if (is_numeric($size)) {
            return $size.'M';
        }

        $unit = strtoupper(substr($size, -1));
        $num = substr($size, 0, -1);

        return $num.$unit;
    }
}
