<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\ValidationRules\CronRule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Throwable;

class CreateCronJob
{
    public function create(Server $server, array $input, ?Site $site = null): CronJob
    {
        Validator::make($input, self::rules($input, $server, $site))->validate();

        app(SyncCronJobs::class)->sync($server, [$input['user']]);

        $cronJob = $server->cronJobs()->create([
            ...self::attributes($input, $site),
            'status' => CronjobStatus::CREATING,
        ]);

        try {
            app(SyncCronJobs::class)->write($server, $cronJob->user);
        } catch (Throwable $e) {
            $cronJob->delete();

            throw $e;
        }

        $cronJob->update(['status' => CronjobStatus::READY]);

        return $cronJob;
    }

    public static function attributes(array $input, ?Site $site = null): array
    {
        return [
            'site_id' => $site?->id ?? (empty($input['site_id']) ? null : (int) $input['site_id']),
            'name' => $input['name'] ?? null,
            'user' => $input['user'],
            'command' => $input['command'],
            'frequency' => $input['frequency'] === 'custom' ? $input['custom'] : $input['frequency'],
        ];
    }

    public static function rules(array $input, Server $server, ?Site $site = null): array
    {
        $rules = [
            'command' => ['required', 'string', 'not_regex:/[\r\n]/'],
            'user' => ['required', Rule::in($site?->getSshUsers() ?? $server->getSshUsers())],
            'frequency' => ['required', new CronRule(acceptCustom: true)],
            'name' => ['nullable', 'string', 'max:255'],
        ];

        if (! empty($input['site_id'])) {
            $rules['site_id'] = ['required', 'integer', Rule::exists('sites', 'id')->where('server_id', $server->id)];
        }

        if (($input['frequency'] ?? null) === 'custom') {
            $rules['custom'] = ['required', new CronRule];
        }

        return $rules;
    }
}
