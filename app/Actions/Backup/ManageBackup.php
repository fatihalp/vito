<?php

namespace App\Actions\Backup;

use App\Enums\BackupStatus;
use App\Enums\BackupType;
use App\Enums\DatabaseStatus;
use App\Jobs\Backup\DeleteJob;
use App\Models\Backup;
use App\Models\Server;
use App\ValidationRules\CronRule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ManageBackup
{
    
    public function create(Server $server, array $input): Backup
    {
        if (($input['type'] ?? null) === BackupType::PGBACKREST->value) {
            return app(ManagePgBackRest::class)->create($server, $input);
        }

        $this->validate($server, $input);

        $backup = new Backup([
            'type' => BackupType::DATABASE,
            'server_id' => $server->id,
            'database_id' => $input['database'],
            'storage_id' => $input['storage'],
            'interval' => $input['interval'] == 'custom' ? $input['custom_interval'] : $input['interval'],
            'keep_backups' => $input['keep'],
        ]);
        $backup->enabled = true;
        $backup->save();

        app(RunBackup::class)->run($backup);

        return $backup;
    }

    public function update(Backup $backup, array $input): void
    {
        if ($backup->type === BackupType::PGBACKREST) {
            app(ManagePgBackRest::class)->update($backup, $input);

            return;
        }

        Validator::make($input, $this->scheduleRules($input))->validate();

        $backup->interval = $input['interval'] == 'custom' ? $input['custom_interval'] : $input['interval'];
        $backup->keep_backups = $input['keep'];
        $backup->save();
    }

    public function delete(Backup $backup): void
    {
        if ($backup->type === BackupType::PGBACKREST && $backup->cluster?->replicas()->exists()) {
            throw ValidationException::withMessages([
                'backup' => __('Replicas are built from and back up to this pgBackRest repository. Delete the replicas first.'),
            ]);
        }

        $backup->status = BackupStatus::DELETING;
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);

        dispatch(new DeleteJob($backup))->onQueue('ssh');
    }

    public function enable(Backup $backup): void
    {
        if ($backup->status === BackupStatus::DELETING) {
            throw ValidationException::withMessages([
                'backup' => __('This backup is being deleted and cannot be enabled.'),
            ]);
        }

        $backup->enabled = true;
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);
    }

    public function stop(Backup $backup): void
    {
        $backup->enabled = false;
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);
    }

    private function validate(Server $server, array $input): void
    {
        $rules = [
            'type' => [
                'required',
                Rule::in([BackupType::DATABASE->value]),
            ],
            'storage' => [
                'required',
                Rule::exists('storage_providers', 'id')
                    ->where(fn ($query) => $query->where('project_id', $server->project_id)->orWhereNull('project_id')),
            ],
            ...$this->scheduleRules($input),
        ];

        $rules['database'] = [
            'required',
            Rule::exists('databases', 'id')
                ->whereNull('deleted_at')
                ->where('server_id', $server->id)
                ->where('status', DatabaseStatus::READY),
        ];

        Validator::make($input, $rules)->validate();
    }

    private function scheduleRules(array $input): array
    {
        $rules = [
            'keep' => [
                'required',
                'numeric',
                'min:1',
            ],
            'interval' => [
                'required',
                Rule::in(array_keys(config('core.cronjob_intervals'))),
            ],
        ];

        if (($input['interval'] ?? null) === 'custom') {
            $rules['custom_interval'] = [
                'required',
                new CronRule,
            ];
        }

        return $rules;
    }
}
