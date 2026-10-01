<?php

namespace App\Jobs\DatabaseUpgrade;

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Enums\DatabaseUpgradeStatus;
use App\Exceptions\SSHError;
use App\Models\DatabaseUpgrade;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunDatabaseUpgradeJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 900;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseUpgrade $upgrade, protected int $errors = 0) {}

    public function handle(): void
    {
        $this->run("database-upgrade-{$this->upgrade->id}", function (): void {
            $upgrade = $this->upgrade->refresh();
            $upgrade->touch();
            $action = app(ManageDatabaseUpgrade::class);

            try {
                switch ($upgrade->status) {
                    case DatabaseUpgradeStatus::WAITING_FOR_SERVER:
                        $action->start($upgrade);
                        break;
                    case DatabaseUpgradeStatus::PREPARING:
                        $action->prepare($upgrade);
                        break;
                    case DatabaseUpgradeStatus::COPYING:
                    case DatabaseUpgradeStatus::STREAMING:
                        if ($action->monitor($upgrade)) {
                            return;
                        }
                        break;
                    default:
                        return;
                }
            } catch (SSHError $e) {
                if ($this->errors >= 30) {
                    throw $e;
                }

                $this->next($this->errors + 1);

                return;
            }

            $this->next(0);
        });
    }

    public function failed(Exception $e): void
    {
        $upgrade = DatabaseUpgrade::query()->find($this->upgrade->id);

        if ($upgrade?->status->isActive()) {
            app(ManageDatabaseUpgrade::class)->fail($upgrade, $e->getMessage());
        }
    }

    private function next(int $errors): void
    {
        $minutes = $this->upgrade->refresh()->status === DatabaseUpgradeStatus::STREAMING ? 5 : 1;

        dispatch(new self($this->upgrade, $errors))->onQueue('ssh')->delay(now()->addMinutes($minutes));
    }
}
