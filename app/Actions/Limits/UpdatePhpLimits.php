<?php

namespace App\Actions\Limits;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class UpdatePhpLimits
{
    public function update(Server $server, array $input): void
    {
        $validated = $this->validate($server, $input);

        $version = $validated['version'];
        $uploadMaxFilesize = $this->normalizeSize($validated['upload_max_filesize']);
        $postMaxSize = $this->normalizeSize($validated['post_max_size']);
        $memoryLimit = ! empty($validated['memory_limit']) ? $this->normalizeSize($validated['memory_limit']) : null;
        $maxExecutionTime = ! empty($validated['max_execution_time']) ? (int) $validated['max_execution_time'] : null;

        try {
            $server->ssh('root')->exec(
                view('ssh.services.php.update-php-limits', [
                    'version' => $version,
                    'upload_max_filesize' => $uploadMaxFilesize,
                    'post_max_size' => $postMaxSize,
                    'memory_limit' => $memoryLimit,
                    'max_execution_time' => $maxExecutionTime,
                ]),
                "update-php-limits-{$version}"
            );
        } catch (Throwable $e) {
            throw ValidationException::withMessages([
                'upload_max_filesize' => __('Failed to apply PHP limits: :message', [
                    'message' => $e->getMessage(),
                ]),
            ]);
        }
    }

    private function validate(Server $server, array $input): array
    {
        $validator = Validator::make($input, [
            'version' => [
                'required',
                Rule::exists('services', 'version')
                    ->where('server_id', $server->id)
                    ->where('type', 'php'),
            ],
            'upload_max_filesize' => [
                'required',
                'regex:/^(0|[1-9]\d*[kKmMgG]?)$/',
            ],
            'post_max_size' => [
                'required',
                'regex:/^(0|[1-9]\d*[kKmMgG]?)$/',
            ],
            'memory_limit' => [
                'nullable',
                'regex:/^(-1|[1-9]\d*[kKmMgG]?)$/',
            ],
            'max_execution_time' => [
                'nullable',
                'integer',
                'min:0',
                'max:86400',
            ],
        ], [
            'upload_max_filesize.regex' => __('Please provide a valid upload max filesize (e.g., 210M or 1G).'),
            'post_max_size.regex' => __('Please provide a valid post max size (e.g., 220M or 1G).'),
            'memory_limit.regex' => __('Please provide a valid memory limit (e.g., 512M, 1G, or -1 for unlimited).'),
        ]);

        $validator->after(function ($validator) use ($input): void {
            if ($validator->errors()->hasAny(['upload_max_filesize', 'post_max_size', 'memory_limit'])) {
                return;
            }

            $uploadBytes = $this->parseSizeToBytes($input['upload_max_filesize'] ?? '');
            $postBytes = $this->parseSizeToBytes($input['post_max_size'] ?? '');

            if ($uploadBytes > 0 && $postBytes > 0 && $postBytes < $uploadBytes) {
                $validator->errors()->add(
                    'post_max_size',
                    __('post_max_size must be greater than or equal to upload_max_filesize.')
                );
            }

            if (! empty($input['memory_limit']) && $input['memory_limit'] !== '-1') {
                $memoryBytes = $this->parseSizeToBytes($input['memory_limit']);
                if ($memoryBytes > 0 && $postBytes > 0 && $memoryBytes < $postBytes) {
                    $validator->errors()->add(
                        'memory_limit',
                        __('memory_limit must be greater than or equal to post_max_size.')
                    );
                }
            }
        });

        return $validator->validate();
    }

    private function normalizeSize(string $size): string
    {
        $size = trim($size);
        if ($size === '-1' || $size === '0') {
            return $size;
        }

        if (is_numeric($size)) {
            return $size.'M';
        }

        $unit = strtoupper(substr($size, -1));
        $num = substr($size, 0, -1);

        return $num.$unit;
    }

    private function parseSizeToBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '-1') {
            return PHP_INT_MAX;
        }

        $last = strtolower(substr($value, -1));
        $num = (int) $value;

        return match ($last) {
            'g' => $num * 1024 * 1024 * 1024,
            'm' => $num * 1024 * 1024,
            'k' => $num * 1024,
            default => is_numeric($last) ? (int) $value : $num,
        };
    }
}
