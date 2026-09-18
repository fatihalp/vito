<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\ManagePgBackRest;
use App\Models\Backup;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckPgBackRestJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 300;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected Backup $backup) {}

    public function handle(): void
    {
        $this->run("pgbackrest-check-{$this->backup->id}", function (): void {
            app(ManagePgBackRest::class)->runCheck($this->backup->refresh());
        });
    }

    public function failed(Exception $e): void
    {
        ServerLog::log($this->backup->server, 'pgbackrest-check-failed', $e->getMessage());
    }
}
