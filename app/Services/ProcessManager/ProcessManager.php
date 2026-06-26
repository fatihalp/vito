<?php

namespace App\Services\ProcessManager;

use App\Services\ServiceInterface;

interface ProcessManager extends ServiceInterface
{
    public function create(
        int|string $id,
        string $command,
        string $user,
        bool $autoStart,
        bool $autoRestart,
        int $numprocs,
        string $logFile,
        ?string $directory = null,
        ?int $siteId = null,
    ): void;

    public function delete(int|string $id, ?int $siteId = null): void;

    public function restart(int|string $id, ?int $siteId = null): void;

    public function stop(int|string $id, ?int $siteId = null): void;

    public function start(int|string $id, ?int $siteId = null): void;

    public function restartAll(?int $siteId = null): void;

    /**
     * @param  array<int>  $workerIds
     */
    public function restartByIds(array $workerIds, ?int $siteId = null): void;

    public function getLogs(string $user, string $logPath): string;
}
