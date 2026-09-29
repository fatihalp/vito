<?php

namespace App\Jobs\DatabaseUpgrade;

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Enums\DatabaseUpgradeStatus;
use App\Models\DatabaseUpgrade;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CancelDatabaseUpgradeJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 900;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseUpgrade $upgrade) {}

    public function handle(): void
    {
        $this->run("database-upgrade-{$this->upgrade->id}", function (): void {
            app(ManageDatabaseUpgrade::class)->runCancel($this->upgrade->refresh());
        });
    }

    public function failed(Exception $e): void
    {
        $upgrade = DatabaseUpgrade::query()->find($this->upgrade->id);

        if ($upgrade?->status === DatabaseUpgradeStatus::CANCELLING) {
            app(ManageDatabaseUpgrade::class)->fail($upgrade, $e->getMessage());
        }
    }
}
