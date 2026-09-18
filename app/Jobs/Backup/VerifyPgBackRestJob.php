<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManagePgBackRest;
use App\Models\Backup;
use App\Exceptions\SSHError;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

class VerifyPgBackRestJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected Backup $backup, protected bool $started = false, protected int $errors = 0) {}

    public function handle(): void
    {
        $this->run("pgbackrest-verify-{$this->backup->id}", function (): void {
            $this->backup->refresh();
            $action = app(ManagePgBackRest::class);

            if (! $this->started) {
                if (isset($this->backup->configuration['verify']['started_at']) && Carbon::parse($this->backup->configuration['verify']['started_at'])->gt(now()->subDay())) {
                    return;
                }

                $action->startVerify($this->backup);
            } else {
                try {
                    if ($action->monitorVerify($this->backup)) {
                        return;
                    }
                } catch (SSHError $e) {
                    if ($this->errors >= 30) {
                        throw $e;
                    }

                    dispatch(new self($this->backup, true, $this->errors + 1))->onQueue('ssh')->delay(now()->addMinute());

                    return;
                }
            }

            dispatch(new self($this->backup, true))->onQueue('ssh')->delay(now()->addMinute());
        });
    }

    public function failed(Exception $e): void
    {
        $backup = Backup::query()->find($this->backup->id);

        if ($backup) {
            $configuration = $backup->configuration;
            unset($configuration['verify']);
            $backup->configuration = [...$configuration, 'last_verified_at' => now()->toIso8601String(), 'last_verify_result' => 'failed', 'last_verify_error' => $e->getMessage()];
            $backup->save();
            ServerLog::log($backup->server, 'pgbackrest-verify-failed', $e->getMessage());
            app(CheckBackupHealth::class)->check($backup);
        }
    }
}
