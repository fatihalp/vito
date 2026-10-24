<?php

namespace App\Jobs\Server;

use App\Actions\Server\CheckPhpVersions;
use App\Actions\Service\ProbeServices;
use App\Models\Server;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class CheckPhpVersionsJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Server $server, protected string $run) {}

    public function handle(): void
    {
        $this->run("server-{$this->server->id}", function (): void {
            app(CheckPhpVersions::class)->handle($this->server, $this->run);
        });
    }

    public function failed(Throwable $e): void
    {
        app(CheckPhpVersions::class)->failed($this->server);
    }

    protected function lockSeconds(): int
    {
        return ProbeServices::budget($this->server) + 120;
    }
}
