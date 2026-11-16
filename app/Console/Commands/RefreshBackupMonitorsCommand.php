<?php

namespace App\Console\Commands;

use App\Jobs\RefreshBackupMonitor;
use App\Models\BackupMonitor;
use Illuminate\Console\Command;

class RefreshBackupMonitorsCommand extends Command
{
    protected $signature = 'backup-monitors:refresh';

    protected $description = 'Refresh registered external backup reports';

    public function handle(): int
    {
        BackupMonitor::query()->select('id')->eachById(function (BackupMonitor $monitor): void {
            RefreshBackupMonitor::dispatch($monitor->id);
        });

        return self::SUCCESS;
    }
}
