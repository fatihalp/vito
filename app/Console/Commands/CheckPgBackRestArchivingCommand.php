<?php

namespace App\Console\Commands;

use App\Enums\BackupType;
use App\Enums\ServerStatus;
use App\Jobs\Backup\CheckPgBackRestArchivingJob;
use App\Models\Backup;
use Illuminate\Console\Command;

class CheckPgBackRestArchivingCommand extends Command
{
    protected $signature = 'backups:check-archiving';

    protected $description = 'Check WAL archiving for pgBackRest backups';

    public function handle(): void
    {
        $total = 0;

        Backup::query()
            ->where('type', BackupType::PGBACKREST)
            ->whereNull('status')
            ->whereHas('server', fn ($query) => $query->where('status', ServerStatus::READY))
            ->chunkById(100, function ($backups) use (&$total): void {
                foreach ($backups as $backup) {
                    dispatch(new CheckPgBackRestArchivingJob($backup))->onQueue('ssh');
                    $total++;
                }
            });

        $this->info("{$total} pgBackRest archiving checks queued");
    }
}
