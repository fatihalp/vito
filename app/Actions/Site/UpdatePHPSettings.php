<?php

namespace App\Actions\Site;

use App\Exceptions\SSHError;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;

class UpdatePHPSettings
{
    
    public function update(Site $site, array $input): void
    {
        $existing = is_array($site->type_data['php'] ?? null) ? $site->type_data['php'] : [];
        $mergedInput = array_merge($existing, $input);

        if (isset($mergedInput['upload_max_filesize']) && ! isset($input['max_upload_size']) && ! isset($existing['max_upload_size'])) {
            $mergedInput['max_upload_size'] = $mergedInput['upload_max_filesize'];
        } elseif (isset($mergedInput['max_upload_size']) && ! isset($input['upload_max_filesize']) && ! isset($existing['upload_max_filesize'])) {
            $mergedInput['upload_max_filesize'] = $mergedInput['max_upload_size'];
        }

        if (isset($mergedInput['post_max_size']) && ! isset($input['memory_limit'])) {
            if (isset($mergedInput['memory_limit']) && (int) $mergedInput['memory_limit'] < (int) $mergedInput['post_max_size']) {
                $mergedInput['memory_limit'] = $mergedInput['post_max_size'];
            }
        }

        $validated = $this->validate($mergedInput);

        $typeData = $site->type_data ?? [];
        $typeData['php'] = $validated;
        $site->update(['type_data' => $typeData]);

        $site->webserver()->updateVHost($site);

        app(BroadcastSiteUpdate::class)->broadcast($site);
    }

    
    private function validate(array $input): array
    {
        $validator = Validator::make($input, [
            'max_upload_size' => ['nullable', 'integer', 'min:1', 'max:10240'],
            'client_max_body_size' => ['nullable', 'integer', 'min:1', 'max:10240'],
            'upload_max_filesize' => ['nullable', 'integer', 'min:1', 'max:10240'],
            'post_max_size' => ['nullable', 'integer', 'min:1', 'max:10240'],
            'max_execution_time' => ['nullable', 'integer', 'min:1', 'max:3600'],
            'memory_limit' => ['nullable', 'integer', 'min:16', 'max:8192'],
            'max_input_vars' => ['nullable', 'integer', 'min:100', 'max:100000'],
        ]);

        $validator->after(function ($validator) use ($input): void {
            if ($validator->errors()->hasAny(['max_upload_size', 'upload_max_filesize', 'post_max_size', 'memory_limit'])) {
                return;
            }

            $upload = $input['upload_max_filesize'] ?? $input['max_upload_size'] ?? null;
            $post = $input['post_max_size'] ?? $upload;
            $memory = $input['memory_limit'] ?? null;

            if (is_numeric($upload) && is_numeric($post) && (int) $post < (int) $upload) {
                $validator->errors()->add(
                    'post_max_size',
                    'The post max size must be greater than or equal to the upload max filesize.'
                );
            }

            if (is_numeric($post) && is_numeric($memory) && (int) $memory < (int) $post) {
                $validator->errors()->add(
                    'memory_limit',
                    'The memory limit must be greater than or equal to the post max size.'
                );
            }
        });

        $validated = $validator->validate();

        return [
            'max_upload_size' => $this->intOrNull($validated['max_upload_size'] ?? null),
            'client_max_body_size' => $this->intOrNull($validated['client_max_body_size'] ?? null),
            'upload_max_filesize' => $this->intOrNull($validated['upload_max_filesize'] ?? null),
            'post_max_size' => $this->intOrNull($validated['post_max_size'] ?? null),
            'max_execution_time' => $this->intOrNull($validated['max_execution_time'] ?? null),
            'memory_limit' => $this->intOrNull($validated['memory_limit'] ?? null),
            'max_input_vars' => $this->intOrNull($validated['max_input_vars'] ?? null),
        ];
    }

    private function intOrNull(mixed $value): ?int
    {
        return is_numeric($value) ? (int) $value : null;
    }
}
