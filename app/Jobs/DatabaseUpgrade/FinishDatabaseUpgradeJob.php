<?php

namespace App\Jobs\DatabaseUpgrade;

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Enums\DatabaseUpgradeStatus;
use App\Models\DatabaseUpgrade;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

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

    /**
     * Until the old server stops taking writes nothing has changed, so the upgrade goes back to waiting for the switch.
     */
    public function failed(Exception $e): void
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

            return;
        }

        app(ManageDatabaseUpgrade::class)->fail($upgrade, $e->getMessage());
    }
}
