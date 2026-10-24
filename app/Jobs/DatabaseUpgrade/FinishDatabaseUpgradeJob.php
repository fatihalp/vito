<?php

namespace App\Jobs\DatabaseUpgrade;

use App\Jobs\DatabaseUpgrade\RunDatabaseUpgradeJob;
use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Enums\DatabaseUpgradeStatus;
use App\Models\DatabaseUpgrade;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class FinishDatabaseUpgradeJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 1800;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseUpgrade $upgrade) {}

    public function handle(): void
    {
        $this->run("database-upgrade-{$this->upgrade->id}", function (): void {
            app(ManageDatabaseUpgrade::class)->runFinish($this->upgrade->refresh());
        });
    }

    public function failed(Throwable $e): void
    {
        $upgrade = DatabaseUpgrade::query()->find($this->upgrade->id);

        if ($upgrade?->status !== DatabaseUpgradeStatus::FINISHING) {
            return;
        }

        if (($upgrade->configuration['finish_stage'] ?? 'cutover') === 'cutover') {
            $upgrade->update([
                'status' => DatabaseUpgradeStatus::STREAMING,
                'step' => null,
                'message' => $e->getMessage(),
            ]);

            dispatch(new RunDatabaseUpgradeJob($upgrade))->onQueue('ssh')->delay(now()->addMinute());

            return;
        }

        app(ManageDatabaseUpgrade::class)->fail($upgrade, $e->getMessage());
    }
}
