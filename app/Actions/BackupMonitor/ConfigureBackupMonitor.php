<?php

namespace App\Actions\BackupMonitor;

use App\Models\BackupMonitor;
use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ConfigureBackupMonitor
{
    public function configure(User $user, Server $server, array $input): BackupMonitor
    {
        Gate::forUser($user)->authorize('create', [BackupMonitor::class, $server]);
        $unit = ['nullable', 'string', 'max:128', 'regex:/^[A-Za-z0-9][A-Za-z0-9_.@:-]*\.service\z/'];
        $data = Validator::make($input, [
            'label' => ['required', 'string', 'max:160'],
            'report_server_id' => ['required', 'integer', Rule::exists('servers', 'id')],
            'report_path' => ['bail', 'required', 'string', 'max:512', 'regex:~^/(?:var/(?:lib|log|backups)|srv)/[A-Za-z0-9_/.-]+\.json\z~', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! is_string($value) || array_intersect(['.', '..', ''], explode('/', ltrim($value, '/')))) {
                    $fail(__('The report path must be an absolute JSON file path without traversal.'));
                }
            }],
            'max_age_hours' => ['required', 'integer', 'between:1,168'],
            'backup_unit' => $unit,
            'verify_unit' => $unit,
        ])->validate();
        $source = Server::query()->findOrFail($data['report_server_id']);
        Gate::forUser($user)->authorize('update', $source);

        return BackupMonitor::query()->updateOrCreate(
            ['server_id' => $server->id, 'label' => $data['label']],
            ['report_server_id' => $source->id, 'configuration' => array_intersect_key($data, array_flip(['report_path', 'max_age_hours', 'backup_unit', 'verify_unit'])), 'status' => 'unknown', 'details' => null, 'last_checked_at' => null],
        );
    }
}
