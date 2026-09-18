<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\RestoreToNewServer;
use App\Enums\BackupRestoreStatus;
use App\Exceptions\SSHError;
use App\Models\BackupRestore;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RestoreToNewServerJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 900;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected BackupRestore $restore, protected int $errors = 0) {}

    public function handle(): void
    {
        $this->run("backup-restore-{$this->restore->id}", function (): void {
            $this->restore->refresh()->touch();
            $action = app(RestoreToNewServer::class);

            try {
                if ($this->restore->status === BackupRestoreStatus::WAITING_FOR_SERVER) {
                    $action->start($this->restore);
                } elseif ($this->restore->status !== BackupRestoreStatus::RESTORING || $action->monitor($this->restore)) {
                    return;
                }
            } catch (SSHError $e) {
                if ($this->errors >= 30) {
                    throw $e;
                }

                $this->next($this->errors + 1);

                return;
            }

            $this->next(0);
        });
    }

    public function failed(Exception $e): void
    {
        $restore = BackupRestore::query()->find($this->restore->id);

        if (in_array($restore?->status, [BackupRestoreStatus::WAITING_FOR_SERVER, BackupRestoreStatus::RESTORING], true)) {
            app(RestoreToNewServer::class)->fail($restore, $e->getMessage());
        }
    }

    private function next(int $errors): void
    {
        dispatch(new self($this->restore, $errors))->onQueue('ssh')->delay(now()->addMinute());
    }
}
