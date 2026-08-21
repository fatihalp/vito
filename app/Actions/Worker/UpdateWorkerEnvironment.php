<?php

namespace App\Actions\Worker;

use App\Exceptions\SSHError;
use App\Models\Worker;
use App\Services\ProcessManager\ProcessManager;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateWorkerEnvironment
{
    
    public function update(Worker $worker, array $input): WorkerEnvironmentUpdateResult
    {
        $validated = Validator::make($input, [
            ...self::rules(),
            'restart' => ['sometimes', 'boolean'],
        ])->validate();

        $worker->environment = self::processVariables($validated['variables'], $worker->environment);
        $worker->save();

        
        $processManager = $worker->server->processManager()->handler();
        $processManager->writeConfig($worker);

        if ($validated['restart'] ?? false) {
            app(ManageWorker::class)->restart($worker);

            return WorkerEnvironmentUpdateResult::Restarting;
        }

        return WorkerEnvironmentUpdateResult::PendingRestart;
    }

    
    public static function rules(string $attribute = 'variables'): array
    {
        return [
            $attribute => ['present', 'array', 'max:100'],
            ...self::nestedRules($attribute),
        ];
    }

    
    public static function nestedRules(string $attribute = 'variables'): array
    {
        return [
            "{$attribute}.*.key" => ['required', 'string', 'max:255', 'regex:/^[A-Za-z_][A-Za-z0-9_]*$/', 'distinct'],
            "{$attribute}.*.value" => ['present', 'nullable', 'string', 'max:10000', 'regex:/\A[^\x00-\x1F\x7F"]*\z/'],
            "{$attribute}.*.is_secret" => ['required', 'boolean'],
        ];
    }

    
    public static function processVariables(array $incoming, ?array $stored): array
    {
        $storedMap = [];
        $storedSecrets = [];
        foreach ($stored ?? [] as $variable) {
            $storedMap[$variable['key']] = $variable['value'];
            if ($variable['is_secret']) {
                $storedSecrets[$variable['key']] = true;
            }
        }

        return array_map(function (array $variable) use ($storedMap, $storedSecrets): array {
            $key = (string) $variable['key'];
            $value = (string) ($variable['value'] ?? '');
            $isSecret = (bool) ($variable['is_secret'] ?? false);

            if ($value === '' && isset($storedSecrets[$key])) {
                $isSecret = true;
            }

            if ($isSecret && $value === '' && isset($storedMap[$key])) {
                $value = (string) $storedMap[$key];
            }

            return [
                'key' => $key,
                'value' => $value,
                'is_secret' => $isSecret,
            ];
        }, $incoming);
    }
}

enum WorkerEnvironmentUpdateResult
{
    case PreFirstDeploy;
    case PendingRestart;
    case Restarting;
}
