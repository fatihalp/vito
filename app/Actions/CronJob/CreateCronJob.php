<?php

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Exceptions\SSHError;
use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\ValidationRules\CronRule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CreateCronJob
{
    
    public function create(Server $server, array $input, ?Site $site = null): CronJob
    {
        $this->validate($input, $server, $site);

        
        $siteId = $site?->id;
        if (! $site && isset($input['site_id']) && ! empty($input['site_id'])) {
            $siteId = (int) $input['site_id'];
        }

        $cronJob = new CronJob([
            'name' => $input['name'] ?? null,
            'server_id' => $server->id,
            'site_id' => $siteId,
            'user' => $input['user'],
            'command' => $input['command'],
            'frequency' => $input['frequency'] == 'custom' ? $input['custom'] : $input['frequency'],
            'status' => CronjobStatus::CREATING,
        ]);
        $cronJob->save();

        $server->cron()->update($cronJob->user, CronJob::crontab($server, $cronJob->user));
        $cronJob->status = CronjobStatus::READY;
        $cronJob->save();

        return $cronJob;
    }

        public static function rules(array $input, Server $server, ?Site $site = null): array
    {
        $rules = [
            'command' => [
                'required',
            ],
            'user' => [
                'required',
                Rule::in($site?->getSshUsers() ?? $server->getSshUsers()),
            ],
            'frequency' => [
                'required',
                new CronRule(acceptCustom: true),
            ],
            'name' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];

        
        if (isset($input['site_id']) && ! empty($input['site_id'])) {
            $rules['site_id'] = [
                'required',
                'integer',
                Rule::exists('sites', 'id')->where('server_id', $server->id),
            ];
        }

        if (isset($input['frequency']) && $input['frequency'] == 'custom') {
            $rules['custom'] = [
                'required',
                new CronRule,
            ];
        }

        return $rules;
    }

    private function validate(array $input, Server $server, ?Site $site = null): void
    {
        Validator::make($input, self::rules($input, $server, $site))->validate();
    }
}
