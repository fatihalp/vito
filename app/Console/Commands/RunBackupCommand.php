<?php

namespace App\Console\Commands;

use App\Actions\Backup\ManagePgBackRest;
use App\Actions\Backup\RunBackup;
use App\Enums\BackupType;
use App\Models\Backup;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class RunBackupCommand extends Command
{
    protected $signature = 'backups:run';

    protected $description = 'Run backups that are due';

    public function handle(): void
    {
        $total = 0;
        $failed = 0;

        Backup::query()
            ->where('enabled', true)
            ->whereNull('status')
            ->whereHas('server')
            ->with('server')
            ->chunkById(100, function ($backups) use (&$total, &$failed): void {
                /** @var Backup $backup */
                foreach ($backups as $backup) {
                    try {
                        $total += (int) $this->start($backup);
                    } catch (Throwable $e) {
                        Log::warning('Failed to run backup', [
                            'backup_id' => $backup->id,
                            'server_id' => $backup->server_id,
                            'error' => $e->getMessage(),
                        ]);
                        $failed++;
                    }
                }
            });

        $this->info("{$total} backups started, {$failed} failed");
    }

    /**
     * Starts a backup whose schedule came due after its last run, so a run missed while Vito was down starts once it is back.
     */
    private function start(Backup $backup): bool
    {
        if ($backup->type === BackupType::PGBACKREST) {
            return app(ManagePgBackRest::class)->schedule($backup->refresh());
        }

        $due = Backup::lastDue((string) $backup->interval, now());

        if ($due === null || $due->lte($backup->files()->latest('id')->value('created_at') ?? $backup->created_at)) {
            return false;
        }

        app(RunBackup::class)->run($backup);

        return true;
    }
}
