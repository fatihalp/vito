<?php

namespace App\Console\Commands;

use App\Actions\Backup\CheckBackupHealth;
use App\Models\Backup;
use Illuminate\Console\Command;

class CheckBackupHealthCommand extends Command
{
    protected $signature = 'backups:check-health';

    protected $description = 'Alert when backups fail, stop running or lose WAL, and when they recover';

    public function handle(): void
    {
        $total = 0;

        Backup::query()
            ->whereHas('server')
            ->chunkById(100, function ($backups) use (&$total): void {
                foreach ($backups as $backup) {
                    app(CheckBackupHealth::class)->check($backup);
                    $total++;
                }
            });

        $this->info("{$total} backups checked");
    }
}
