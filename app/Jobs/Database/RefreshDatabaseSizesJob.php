<?php

namespace App\Jobs\Database;

use App\Actions\Database\RefreshDatabaseSizes;
use App\Models\Server;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class RefreshDatabaseSizesJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 30;

    public function __construct(protected Server $server) {}

    public function handle(): void
    {
        $this->run("server-{$this->server->id}", function (): void {
            app(RefreshDatabaseSizes::class)->handle($this->server);
        });
    }

    public function failed(Throwable $e): void
    {
        app(RefreshDatabaseSizes::class)->failed($this->server);
    }
}
