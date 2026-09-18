<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\BroadcastBackupUpdate;
use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManagePgBackRest;
use App\Enums\BackupStatus;
use App\Models\Backup;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SetupPgBackRestJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 540;

    public function __construct(protected Backup $backup) {}

    public function handle(): void
    {
        $this->run("backup-{$this->backup->id}", function (): void {
            app(ManagePgBackRest::class)->setup($this->backup);
        });
    }

    public function failed(Exception $e): void
    {
        $this->backup->status = BackupStatus::FAILED;
        $this->backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($this->backup);
        ServerLog::log($this->backup->server, 'pgbackrest-setup-failed', $e->getMessage());
        app(CheckBackupHealth::class)->check($this->backup);
    }
}
