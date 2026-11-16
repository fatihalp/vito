<?php

namespace App\Actions\BackupMonitor;

use App\Enums\BackupMonitorStatus;
use App\Models\BackupMonitor;
use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ConfigureBackupMonitor
{
    private const REPORT_PATH_RULES = [
        'required',
        'string',
        'max:512',
        'regex:~^/(var/lib|var/log|var/backups|srv)/[\w./-]+\.json\z~',
        'not_regex:~/\.\./~',
    ];

    private const CONFIGURATION_KEYS = ['report_path', 'max_age_hours', 'backup_unit', 'verify_unit'];

    private const UNIT_RULES = ['nullable', 'string', 'regex:'.BackupMonitor::UNIT_PATTERN];

    public function configure(User $user, Server $server, array $input): BackupMonitor
    {
        Gate::forUser($user)->authorize('create', [BackupMonitor::class, $server]);

        $data = Validator::make($input, [
            'label' => ['required', 'string', 'max:160'],
            'report_server_id' => ['required', 'integer', Rule::exists('servers', 'id')],
            'report_path' => self::REPORT_PATH_RULES,
            'max_age_hours' => ['required', 'integer', 'between:1,168'],
            'backup_unit' => self::UNIT_RULES,
            'verify_unit' => self::UNIT_RULES,
        ])->validate();

        $source = Server::query()->findOrFail($data['report_server_id']);
        Gate::forUser($user)->authorize('update', $source);

        return BackupMonitor::query()->updateOrCreate(
            ['server_id' => $server->id, 'label' => $data['label']],
            [
                'report_server_id' => $source->id,
                'configuration' => Arr::only($data, self::CONFIGURATION_KEYS),
                'status' => BackupMonitorStatus::UNKNOWN,
                'details' => null,
                'last_checked_at' => null,
            ],
        );
    }
}
