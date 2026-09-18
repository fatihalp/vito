<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\ManagePgBackRest;
use App\Enums\BackupFileStatus;
use App\Exceptions\SSHError;
use App\Models\BackupFile;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MonitorPgBackRestJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected BackupFile $file, protected int $errors = 0) {}

    public function handle(): void
    {
        $this->run("pgbackrest-monitor-{$this->file->id}", function (): void {
            $this->file->refresh();

            if ($this->file->status !== BackupFileStatus::CREATING) {
                return;
            }

            try {
                $finished = app(ManagePgBackRest::class)->monitor($this->file);
            } catch (SSHError $e) {
                if ($this->errors >= 30) {
                    app(ManagePgBackRest::class)->fail($this->file, __('Vito could not reach the server to check this backup: :error', ['error' => $e->getMessage()]));

                    return;
                }

                $this->next($this->errors + 1);

                return;
            }

            if (! $finished) {
                $this->next(0);
            }
        });
    }

    public function failed(Exception $e): void
    {
        $file = BackupFile::query()->find($this->file->id);

        if ($file?->status === BackupFileStatus::CREATING) {
            app(ManagePgBackRest::class)->fail($file, $e->getMessage());
        }
    }

    private function next(int $errors): void
    {
        dispatch(new self($this->file, $errors))->onQueue('ssh')->delay(now()->addMinute());
    }
}
