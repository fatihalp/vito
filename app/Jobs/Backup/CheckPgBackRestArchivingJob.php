<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManagePgBackRest;
use App\Models\Backup;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckPgBackRestArchivingJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected Backup $backup) {}

    public function handle(): void
    {
        $this->run("pgbackrest-archiving-{$this->backup->id}", function (): void {
            app(ManagePgBackRest::class)->checkArchiving($this->backup);
            app(CheckBackupHealth::class)->check($this->backup);
        });
    }

    public function failed(Exception $e): void
    {
        ServerLog::log($this->backup->server, 'pgbackrest-archiving-check-failed', $e->getMessage());
    }
}
