<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Laravel\Horizon\Horizon;
use Laravel\Horizon\HorizonApplicationServiceProvider;
use Laravel\Horizon\SupervisorCommandString;
use Laravel\Horizon\WorkerCommandString;
use Symfony\Component\Process\PhpExecutableFinder;

class HorizonServiceProvider extends HorizonApplicationServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        parent::boot();

        // FrankenPHP's embedded PHP sets PHP_BINARY to an empty string, so
        // Horizon can't find php to spawn supervisor/worker processes.
        // Fall back to the php wrapper found on PATH.
        if (PHP_BINARY === '') {
            $php = (new PhpExecutableFinder)->find(false);
            if ($php) {
                SupervisorCommandString::$command = "exec {$php} artisan horizon:supervisor";
                WorkerCommandString::$command = "exec {$php} artisan horizon:work";
            }
        }
    }

    /**
     * Register the Horizon gate.
     *
     * This gate determines who can access Horizon in non-local environments.
     */
    protected function gate(): void
    {
        Gate::define('viewHorizon', function (?User $user = null) {
            return $user?->isAdmin();
        });
    }
}
