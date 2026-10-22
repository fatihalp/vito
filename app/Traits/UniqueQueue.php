<?php

namespace App\Traits;

use Closure;
use Illuminate\Database\DetectsConcurrencyErrors;
use Illuminate\Support\Facades\Cache;
use Throwable;

trait UniqueQueue
{
    use DetectsConcurrencyErrors;

    public $tries = 120;

    public function retryUntil(): \DateTime
    {
        return now()->addHour();
    }

    protected function lockSeconds(): int
    {
        return max(600, (int) config('horizon.defaults.ssh.timeout', 1200) + 60, ($this->timeout ?? 0) + 60);
    }

    public function run(string $key, Closure $callback): void
    {
        $lockKey = "unique-queue:$key";

        $lock = Cache::lock($lockKey, $this->lockSeconds());

        if ($lock->get()) {
            try {
                $callback();
            } catch (Throwable $e) {
                if ($this->isTransientDatabaseError($e) && $this->attempts() < $this->tries) {
                    $this->release(min(30, $this->attempts() * 2));

                    return;
                }

                $this->fail($e);
            } finally {
                $lock->release();
            }
        } else {
            $this->release(30);
        }
    }

    protected function isTransientDatabaseError(Throwable $e): bool
    {
        return $this->causedByConcurrencyError($e);
    }
}
